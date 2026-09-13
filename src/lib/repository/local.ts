import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { JourneyData, Photo, Place, StoryBlock, Trip } from "../types";
import { extensionFor, type JourneyRepository, type UploadedFile, type UploadTarget, UPLOAD_TARGET_TTL_MS } from "./types";

/** Data as it may sit on disk: saved before story blocks, a place's story was one text and each photo had a sort order. */
interface SavedJourney {
  trips: Trip[];
  places: (Omit<Place, "storyBlocks"> & { storyBlocks?: StoryBlock[]; story?: string })[];
  photos: (Photo & { sortOrder?: number })[];
}

/** Old stories become the story text as one text block, followed by the place's photos in their old sort order. */
function upgradeSavedJourney(saved: SavedJourney): JourneyData {
  const photos = saved.photos.map(({ sortOrder = 0, ...photo }) => ({ photo, sortOrder }));
  const photosInOldOrder = [...photos].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.photo);
  const oldStory = (placeId: string, story = ""): StoryBlock[] => [
    ...(story.trim() ? [{ type: "text" as const, text: story }] : []),
    ...photosInOldOrder.filter((p) => p.placeId === placeId).map((p) => ({ type: "photo" as const, photoId: p.id })),
  ];

  return {
    trips: saved.trips,
    places: saved.places.map(({ story, storyBlocks, ...place }) => ({ ...place, storyBlocks: storyBlocks ?? oldStory(place.id, story) })),
    photos: photos.map((p) => p.photo),
  };
}

export interface LocalRepositoryOptions {
  /** Where edits are written. */
  dataFile: string;
  /** Read until the first edit creates `dataFile`. */
  seedFile: string;
  uploadsDir: string;
  publicUrlPrefix: string;
  /** How long an upload target lasts. Defaults to the shared expiry. */
  uploadTargetTtlMs?: number;
}

/** Where this store's upload targets point: the dev-only endpoint that takes the bytes. */
const DEV_UPLOAD_PATH = "/api/dev-uploads";

/** What the dev upload endpoint made of the bytes it was sent. */
export type LocalUploadReceipt = "stored" | "unknown-upload" | "wrong-content-type";

/** A target handed out and not yet spent: the one place and one file type it's good for. */
interface PendingUpload {
  placeId: string;
  contentType: string;
  expiresAt: number;
}

// The turbopackIgnore comments keep these dev-only paths from dragging the whole project into the deploy bundle.

async function readIfPresent(path: string): Promise<Buffer | null> {
  try {
    return await readFile(/* turbopackIgnore: true */ path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readJson(path: string): Promise<SavedJourney | null> {
  const contents = await readIfPresent(path);
  return contents ? JSON.parse(contents.toString("utf8")) : null;
}

// Upload ids reach us back from a URL, so only an id shaped like one we handed out ever becomes a path.
const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Deliberately not under uploadsDir: that folder is served to the public as it stands, and bytes
// nobody has confirmed yet aren't part of the journal. They wait beside the data file instead.
const pendingDir = (options: LocalRepositoryOptions) => join(dirname(options.dataFile), "pending-uploads");
const pendingRecord = (options: LocalRepositoryOptions, uploadId: string) => join(pendingDir(options), `${uploadId}.json`);
const pendingBytes = (options: LocalRepositoryOptions, uploadId: string) => join(pendingDir(options), `${uploadId}.bin`);

/** The target behind this id while it's still good for something, and null once it isn't. */
async function readPending(options: LocalRepositoryOptions, uploadId: string): Promise<PendingUpload | null> {
  if (!UPLOAD_ID.test(uploadId)) return null;
  const contents = await readIfPresent(pendingRecord(options, uploadId));
  if (!contents) return null;
  const pending: PendingUpload = JSON.parse(contents.toString("utf8"));
  return Date.now() >= pending.expiresAt ? null : pending;
}

/**
 * What the dev-only upload endpoint does with the bytes it receives, so that endpoint stays a thin
 * HTTP wrapper. A target only takes the file type it was handed out for, and only until it expires.
 */
export async function receiveLocalUpload(options: LocalRepositoryOptions, uploadId: string, file: UploadedFile): Promise<LocalUploadReceipt> {
  const pending = await readPending(options, uploadId);
  if (!pending) return "unknown-upload";
  if (file.contentType !== pending.contentType) return "wrong-content-type";

  await mkdir(/* turbopackIgnore: true */ pendingDir(options), { recursive: true });
  await writeFile(/* turbopackIgnore: true */ pendingBytes(options, uploadId), file.bytes);
  return "stored";
}

/** File-backed store for local development, so the app runs before Supabase is set up. */
export function createLocalRepository(options: LocalRepositoryOptions): JourneyRepository {
  const load = async (): Promise<JourneyData> => {
    const saved = (await readJson(options.dataFile)) ?? (await readJson(options.seedFile));
    return saved ? upgradeSavedJourney(saved) : { trips: [], places: [], photos: [] };
  };

  async function update<T>(change: (data: JourneyData) => T): Promise<T> {
    const data = await load();
    const result = change(data);
    await mkdir(dirname(/* turbopackIgnore: true */ options.dataFile), { recursive: true });
    await writeFile(/* turbopackIgnore: true */ options.dataFile, JSON.stringify(data, null, 2));
    return result;
  }

  const addPhoto = async (input: Parameters<JourneyRepository["addPhoto"]>[0], file: UploadedFile): Promise<Photo> => {
    const id = randomUUID();
    const fileName = `${id}.${extensionFor(file.contentType)}`;
    await mkdir(/* turbopackIgnore: true */ options.uploadsDir, { recursive: true });
    await writeFile(join(/* turbopackIgnore: true */ options.uploadsDir, fileName), file.bytes);
    return update((data) => {
      const photo = { ...input, id, url: `${options.publicUrlPrefix}/${fileName}` };
      data.photos.push(photo);
      return photo;
    });
  };

  // The store's own id goes last, so an id smuggled in with the input can't replace it.
  return {
    load,
    createTrip: (input) =>
      update((data) => {
        const trip = { ...input, id: randomUUID() };
        data.trips.push(trip);
        return trip;
      }),
    updateTrip: (id, changes) =>
      update((data) => {
        const index = data.trips.findIndex((t) => t.id === id);
        if (index === -1) throw new Error(`No trip with id ${id}.`);
        const trip = { ...data.trips[index], ...changes, id };
        data.trips[index] = trip;
        return trip;
      }),
    deleteTrip: (id) =>
      update((data) => {
        data.trips = data.trips.filter((t) => t.id !== id);
        // Dissolving a trip keeps its places: they simply aren't on a trip any more.
        for (const place of data.places) if (place.tripId === id) place.tripId = null;
      }),
    createPlace: (input) =>
      update((data) => {
        const place = { ...input, id: randomUUID() };
        data.places.push(place);
        return place;
      }),
    updatePlace: (id, changes) =>
      update((data) => {
        const index = data.places.findIndex((p) => p.id === id);
        if (index === -1) throw new Error(`No place with id ${id}.`);
        const place = { ...data.places[index], ...changes, id };
        data.places[index] = place;
        return place;
      }),
    async deletePlace(id) {
      const data = await load();
      if (!data.places.some((p) => p.id === id)) throw new Error(`No place with id ${id}.`);

      // The files go first, for the same reason as deleting one photo: what's deleted
      // has to stop being reachable by URL, and force means one already gone is no obstacle.
      const theirs = data.photos.filter((p) => p.placeId === id);
      for (const photo of theirs) {
        await rm(join(/* turbopackIgnore: true */ options.uploadsDir, basename(photo.url)), { force: true });
      }
      await update((current) => {
        current.places = current.places.filter((p) => p.id !== id);
        current.photos = current.photos.filter((p) => p.placeId !== id);
      });
    },
    addPhoto,

    /**
     * A target the browser can PUT to, backed by the dev-only endpoint that writes into the uploads
     * folder. It's written down rather than held in memory, because preparing and confirming are
     * separate requests and the file arrives in a third.
     */
    async createUploadTarget({ placeId, contentType }) {
      const uploadId = randomUUID();
      const pending: PendingUpload = { placeId, contentType, expiresAt: Date.now() + (options.uploadTargetTtlMs ?? UPLOAD_TARGET_TTL_MS) };
      await mkdir(/* turbopackIgnore: true */ pendingDir(options), { recursive: true });
      await writeFile(/* turbopackIgnore: true */ pendingRecord(options, uploadId), JSON.stringify(pending));

      return {
        uploadId,
        url: `${DEV_UPLOAD_PATH}/${uploadId}`,
        method: "PUT",
        headers: { "content-type": contentType },
        expiresAt: pending.expiresAt,
      } satisfies UploadTarget;
    },

    async finalizeUpload(uploadId, details) {
      const pending = await readPending(options, uploadId);
      if (!pending) return null;
      const bytes = await readIfPresent(pendingBytes(options, uploadId));
      // Nothing arrived, so there's no photo to record: the journal never shows a broken image.
      if (!bytes) return null;

      const photo = await addPhoto({ ...details, placeId: pending.placeId }, { bytes: new Uint8Array(bytes), contentType: pending.contentType });
      // The target is spent, so the same id can't record the same file a second time.
      await rm(/* turbopackIgnore: true */ pendingRecord(options, uploadId), { force: true });
      await rm(/* turbopackIgnore: true */ pendingBytes(options, uploadId), { force: true });
      return photo;
    },

    updatePhoto: (id, changes) =>
      update((data) => {
        const index = data.photos.findIndex((p) => p.id === id);
        if (index === -1) throw new Error(`No photo with id ${id}.`);
        const photo = { ...data.photos[index], ...changes, id };
        data.photos[index] = photo;
        return photo;
      }),
    async deletePhoto(id) {
      const photo = (await load()).photos.find((p) => p.id === id);
      if (!photo) throw new Error(`No photo with id ${id}.`);
      // The file is named in the url the store gave it. Force, because a file already gone
      // shouldn't keep the record alive: either way nothing is left to reach.
      await rm(join(/* turbopackIgnore: true */ options.uploadsDir, basename(photo.url)), { force: true });
      await update((data) => {
        data.photos = data.photos.filter((p) => p.id !== id);
      });
    },
  };
}
