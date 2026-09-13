import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Photo, Place, StoryBlock, Trip } from "../types";
import { extensionFor, type JourneyRepository, type NewPhoto, type NewPlace, type NewTrip } from "./types";

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

/** Server-only: uses the service role key, so it must never reach the browser. */
export function createSupabaseRepository(url: string, serviceRoleKey: string): JourneyRepository {
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

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
