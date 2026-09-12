import type { JourneyData, Photo, Place, Trip } from "../types";

export type NewTrip = Omit<Trip, "id">;
export type NewPlace = Omit<Place, "id">;
export type NewPhoto = Omit<Photo, "id" | "url">;

export interface UploadedFile {
  bytes: Uint8Array;
  contentType: string;
}

/** Where the journey is stored: Supabase in production, a JSON file in local dev. */
export interface JourneyRepository {
  load(): Promise<JourneyData>;
  createTrip(input: NewTrip): Promise<Trip>;
  createPlace(input: NewPlace): Promise<Place>;
  /** Changes only the fields given. Throws if the place doesn't exist. */
  updatePlace(id: string, changes: Partial<NewPlace>): Promise<Place>;
  addPhoto(input: NewPhoto, file: UploadedFile): Promise<Photo>;
}

// An allowlist, not image/*: SVGs can carry scripts and uploads are served publicly.
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
};

export const IMAGE_TYPES = Object.keys(EXTENSIONS);
export const isAllowedImageType = (contentType: string) => contentType in EXTENSIONS;
export const extensionFor = (contentType: string) => EXTENSIONS[contentType] ?? "img";
