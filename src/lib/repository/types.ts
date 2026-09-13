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
  /** Changes only the fields given. Throws if the trip doesn't exist. */
  updateTrip(id: string, changes: Partial<NewTrip>): Promise<Trip>;
  /** Removes the trip and clears it from its places, which stay on the globe. */
  deleteTrip(id: string): Promise<void>;
  createPlace(input: NewPlace): Promise<Place>;
  /** Changes only the fields given. Throws if the place doesn't exist. */
  updatePlace(id: string, changes: Partial<NewPlace>): Promise<Place>;
  /** Removes the place along with its photos and their stored files, leaving nothing orphaned. */
  deletePlace(id: string): Promise<void>;
  addPhoto(input: NewPhoto, file: UploadedFile): Promise<Photo>;
  /** Changes only the fields given. Throws if the photo doesn't exist. */
  updatePhoto(id: string, changes: Partial<NewPhoto>): Promise<Photo>;
  /** Removes the photo and its stored file, so it stops being reachable by URL. */
  deletePhoto(id: string): Promise<void>;
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
