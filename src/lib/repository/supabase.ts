import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Photo, Place, StoryBlock, Trip } from "../types";
import { bytesLookLike, IMAGE_SIGNATURE_BYTES } from "./image-bytes";
import {
  extensionFor,
  type JourneyRepository,
  type NewPhoto,
  type NewPlace,
  type NewTrip,
  UPLOAD_TARGET_TTL_MS,
  type UploadTarget,
} from "./types";

export const PHOTO_BUCKET = "photos";

// Rows are snake_case in Postgres; the app is camelCase.
interface TripRow {
  id: string;
  name: string;
  story: string;
  start_date: string | null;
  end_date: string | null;
}

interface PlaceRow {
  id: string;
  kind: Place["kind"];
  name: string;
  lat: number;
  lng: number;
  country_code: string;
  parent_id: string | null;
  trip_id: string | null;
  visited_on: string[];
  story_blocks: StoryBlock[];
}

interface PhotoRow {
  id: string;
  place_id: string;
  storage_path: string;
  caption: string;
  taken_at: string | null;
  lat: number | null;
  lng: number | null;
}

const tripFromRow = (r: TripRow): Trip => ({
  id: r.id,
  name: r.name,
  story: r.story,
  startDate: r.start_date,
  endDate: r.end_date,
});

const placeFromRow = (r: PlaceRow): Place => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  lat: r.lat,
  lng: r.lng,
  countryCode: r.country_code,
  parentId: r.parent_id,
  tripId: r.trip_id,
  visitedOn: r.visited_on,
  storyBlocks: r.story_blocks,
});

const tripColumns = {
  name: "name",
  story: "story",
  startDate: "start_date",
  endDate: "end_date",
} as const satisfies Record<keyof NewTrip, keyof TripRow>;

const placeColumns = {
  kind: "kind",
  name: "name",
  lat: "lat",
  lng: "lng",
  countryCode: "country_code",
  parentId: "parent_id",
  tripId: "trip_id",
  visitedOn: "visited_on",
  storyBlocks: "story_blocks",
} as const satisfies Record<keyof NewPlace, keyof PlaceRow>;

const photoColumns = {
  placeId: "place_id",
  caption: "caption",
  takenAt: "taken_at",
  lat: "lat",
  lng: "lng",
} as const satisfies Record<keyof NewPhoto, keyof PhotoRow>;

/** Only the fields given, so an update leaves the rest alone and an id smuggled in with the input is ignored. */
function toRow<T, R>(columns: Record<keyof T, keyof R>, value: Partial<T>): Partial<R> {
  const row: Record<string, unknown> = {};
  for (const field of Object.keys(columns) as (keyof T)[]) {
    if (value[field] !== undefined) row[columns[field] as string] = value[field];
  }
  return row as Partial<R>;
}

function unwrap<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** One permission to upload: which place it belongs to, where the bytes go, what they may be, and when it lapses. */
interface SignedTarget {
  placeId: string;
  path: string;
  contentType: string;
  expiresAt: number;
}

/**
 * A signing key of its own, derived from the service role key so there's no second secret to
 * configure and the database credential never doubles as one.
 */
const signingKey = (serviceRoleKey: string) => createHmac("sha256", serviceRoleKey).update("upload-target-v1").digest();

const sign = (key: Buffer, payload: string) => createHmac("sha256", key).update(payload).digest("base64url");

/**
 * The upload id carries the target itself, signed, so the store needs no table of pending uploads:
 * the id comes back from the browser, and only one this server handed out survives the check.
 */
function packUploadId(key: Buffer, target: SignedTarget): string {
  const payload = Buffer.from(JSON.stringify(target)).toString("base64url");
  return `${payload}.${sign(key, payload)}`;
}

/** The target behind this id, or null if it wasn't signed by us or isn't shaped like one of ours. */
function unpackUploadId(key: Buffer, uploadId: string): SignedTarget | null {
  const [payload, signature, ...rest] = uploadId.split(".");
  if (!payload || !signature || rest.length) return null;

  // The signature is checked before the payload is read, so only our own JSON is ever parsed.
  const expected = Buffer.from(sign(key, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const target = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SignedTarget;
  const shaped =
    typeof target?.placeId === "string" &&
    typeof target.path === "string" &&
    typeof target.contentType === "string" &&
    typeof target.expiresAt === "number";
  return shaped ? target : null;
}

/** Long enough to fetch a few bytes, short enough that the URL is useless by the time it could leak. */
const HEAD_URL_TTL_SECONDS = 60;

/** An object too short to hold a signature: asking for bytes it doesn't have is how storage says so. */
const RANGE_NOT_SATISFIABLE = 416;

/**
 * The first bytes of a stored object. Fetched over a range request rather than downloaded, so
 * confirming a photo doesn't pull a whole holiday snap back through this server, which is the point
 * of uploading straight to storage. A server that ignores the range sends more than was asked for,
 * which costs bandwidth but still answers the question.
 *
 * Failing to read throws rather than answering with nothing, so a network blip is never mistaken
 * for a file that isn't a photo: the owner sees something went wrong, not that their upload is gone.
 */
async function readHead(client: SupabaseClient, path: string): Promise<Uint8Array> {
  const signed = await client.storage.from(PHOTO_BUCKET).createSignedUrl(path, HEAD_URL_TTL_SECONDS);
  if (signed.error || !signed.data) throw new Error(signed.error?.message ?? `Couldn't read back ${path}.`);

  const response = await fetch(signed.data.signedUrl, { headers: { range: `bytes=0-${IMAGE_SIGNATURE_BYTES - 1}` } });
  // Too short to be any image, so the empty head below is turned away as one.
  if (response.status === RANGE_NOT_SATISFIABLE) return new Uint8Array();
  if (!response.ok) throw new Error(`Couldn't read back ${path}: ${response.status}.`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Server-only: uses the service role key, so it must never reach the browser. */
export function createSupabaseRepository(url: string, serviceRoleKey: string): JourneyRepository {
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const uploadKey = signingKey(serviceRoleKey);

  const photoFromRow = (r: PhotoRow): Photo => ({
    id: r.id,
    placeId: r.place_id,
    url: client.storage.from(PHOTO_BUCKET).getPublicUrl(r.storage_path).data.publicUrl,
    caption: r.caption,
    takenAt: r.taken_at,
    lat: r.lat,
    lng: r.lng,
  });

  return {
    async load() {
      const [trips, places, photos] = await Promise.all([
        client.from("trips").select("*").order("created_at"),
        client.from("places").select("*").order("created_at"),
        client.from("photos").select("*").order("created_at"),
      ]);
      return {
        trips: unwrap<TripRow[]>(trips).map(tripFromRow),
        places: unwrap<PlaceRow[]>(places).map(placeFromRow),
        photos: unwrap<PhotoRow[]>(photos).map(photoFromRow),
      };
    },

    async createTrip(input) {
      const row = toRow<NewTrip, TripRow>(tripColumns, input);
      return tripFromRow(unwrap<TripRow>(await client.from("trips").insert(row).select().single()));
    },

    async updateTrip(id, changes) {
      const row = toRow<NewTrip, TripRow>(tripColumns, changes);
      return tripFromRow(unwrap<TripRow>(await client.from("trips").update(row).eq("id", id).select().single()));
    },

    async deleteTrip(id) {
      // places.trip_id is `on delete set null`, so the places stay behind and simply leave the trip.
      unwrap(await client.from("trips").delete().eq("id", id));
    },

    async createPlace(input) {
      const row = toRow<NewPlace, PlaceRow>(placeColumns, input);
      return placeFromRow(unwrap<PlaceRow>(await client.from("places").insert(row).select().single()));
    },

    async updatePlace(id, changes) {
      const row = toRow<NewPlace, PlaceRow>(placeColumns, changes);
      return placeFromRow(unwrap<PlaceRow>(await client.from("places").update(row).eq("id", id).select().single()));
    },

    async deletePlace(id) {
      const rows = unwrap<PhotoRow[]>(await client.from("photos").select("*").eq("place_id", id));
      // Storage objects aren't reached by the row cascade, so the files go first and explicitly:
      // a place's photos must stop being reachable by URL, not just stop being listed.
      if (rows.length) {
        const removed = await client.storage.from(PHOTO_BUCKET).remove(rows.map((r) => r.storage_path));
        if (removed.error) throw new Error(removed.error.message);
      }
      // photos.place_id is `on delete cascade`, so the photo rows go with the place.
      unwrap(await client.from("places").delete().eq("id", id));
    },

    async addPhoto(input, file) {
      const path = `${input.placeId}/${randomUUID()}.${extensionFor(file.contentType)}`;
      const upload = await client.storage.from(PHOTO_BUCKET).upload(path, file.bytes, { contentType: file.contentType });
      if (upload.error) throw new Error(upload.error.message);

      const row = {
        place_id: input.placeId,
        storage_path: path,
        caption: input.caption,
        taken_at: input.takenAt,
        lat: input.lat,
        lng: input.lng,
      };
      return photoFromRow(unwrap<PhotoRow>(await client.from("photos").insert(row).select().single()));
    },

    /**
     * A signed URL the browser can PUT one photo to, so the bytes never pass through this server.
     * The path fixes the place, and the bucket's own allowlist and size cap are the second line of
     * defence behind the content type checked at prepare.
     */
    async createUploadTarget({ placeId, contentType }) {
      const path = `${placeId}/${randomUUID()}.${extensionFor(contentType)}`;
      const signed = await client.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
      if (signed.error) throw new Error(signed.error.message);

      // Supabase fixes its own token at two hours and won't shorten it. Ours lapses on the stated
      // schedule and finalizing enforces it, so a leaked target stops being able to put anything
      // into the journal well before then — though the URL behind it still takes bytes for the
      // full two hours, and nothing sweeps up what it leaves.
      const expiresAt = Date.now() + UPLOAD_TARGET_TTL_MS;
      return {
        uploadId: packUploadId(uploadKey, { placeId, path, contentType, expiresAt }),
        url: signed.data.signedUrl,
        method: "PUT",
        headers: { "content-type": contentType },
        expiresAt,
      } satisfies UploadTarget;
    },

    async finalizeUpload(uploadId, details) {
      const target = unpackUploadId(uploadKey, uploadId);
      if (!target || Date.now() >= target.expiresAt) return null;

      // What the browser says arrived doesn't count: the object has to actually be in the bucket,
      // so the journal never records a photo whose file never turned up.
      const found = await client.storage.from(PHOTO_BUCKET).info(target.path);
      if (found.error || !found.data) return null;

      // Storage doesn't always record a type. What it does record has to match the target; when it
      // records nothing there's nothing to contradict, and the object is left where it is either
      // way. Deleting a photo the owner just watched go up is the one mistake with no way back.
      const arrived = (found.data.contentType ?? "").split(";")[0].trim().toLowerCase();
      if (arrived && arrived !== target.contentType) return null;

      // Every check so far — the browser, the bucket's allowlist, the type storage recorded — rests
      // on the type the browser declared, which it read off the file's name. The bytes are the only
      // thing that can contradict it, so the object's first few are read back here. What isn't a
      // photo is left in the bucket where an unconfirmed upload is left, to be removed by hand.
      if (!bytesLookLike(target.contentType, await readHead(client, target.path))) return null;

      // A target is good for one photo. Confirming twice would otherwise leave two rows sharing one
      // object, and deleting either would break the other. Two confirmations racing can still slip
      // past this, which needs a unique index on storage_path to close properly.
      const already = unwrap<PhotoRow[]>(await client.from("photos").select("id").eq("storage_path", target.path));
      if (already.length) return null;

      // The place comes from the signed target, never from whoever confirms it.
      const row = { ...toRow<NewPhoto, PhotoRow>(photoColumns, { ...details, placeId: target.placeId }), storage_path: target.path };
      return photoFromRow(unwrap<PhotoRow>(await client.from("photos").insert(row).select().single()));
    },

    async updatePhoto(id, changes) {
      const row = toRow<NewPhoto, PhotoRow>(photoColumns, changes);
      return photoFromRow(unwrap<PhotoRow>(await client.from("photos").update(row).eq("id", id).select().single()));
    },

    async deletePhoto(id) {
      const { storage_path } = unwrap<PhotoRow>(await client.from("photos").select("*").eq("id", id).single());
      // The file goes first, because the point of deleting a photo is that its URL stops working:
      // an object left behind stays reachable by anyone holding the link. If the row delete then
      // fails, the place shows a broken image until it's deleted again, which is visible and fixable.
      const removed = await client.storage.from(PHOTO_BUCKET).remove([storage_path]);
      if (removed.error) throw new Error(removed.error.message);
      unwrap(await client.from("photos").delete().eq("id", id));
    },
  };
}
