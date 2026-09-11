import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
    createPlace: (input) =>
      update((data) => {
        const place = { ...input, id: randomUUID() };
        data.places.push(place);
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
  };
}
