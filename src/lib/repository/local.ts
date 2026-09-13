import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { JourneyData, Photo, Place, StoryBlock, Trip } from "../types";
import { extensionFor, type JourneyRepository } from "./types";

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
}

// The turbopackIgnore comments keep these dev-only paths from dragging the whole project into the deploy bundle.

async function readJson(path: string): Promise<SavedJourney | null> {
  try {
    return JSON.parse(await readFile(/* turbopackIgnore: true */ path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
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
    async addPhoto(input, file) {
      const id = randomUUID();
      const fileName = `${id}.${extensionFor(file.contentType)}`;
      await mkdir(/* turbopackIgnore: true */ options.uploadsDir, { recursive: true });
      await writeFile(join(/* turbopackIgnore: true */ options.uploadsDir, fileName), file.bytes);
      return update((data) => {
        const photo = { ...input, id, url: `${options.publicUrlPrefix}/${fileName}` };
        data.photos.push(photo);
        return photo;
      });
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
