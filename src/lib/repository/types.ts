import type { JourneyData, Photo, Place, Trip } from "../types";

export type NewTrip = Omit<Trip, "id">;
export type NewPlace = Omit<Place, "id">;
export type NewPhoto = Omit<Photo, "id" | "url">;

export interface UploadedFile {
  bytes: Uint8Array;
  contentType: string;
}

/** Which place a file may be sent for, and what kind of file it may be. */
export interface UploadRequest {
  placeId: string;
  contentType: string;
}

/** Permission to send one file straight to storage: where to send it, and the id that records it afterwards. */
export interface UploadTarget {
  /** Opaque, and the only thing confirming the upload needs. */
  uploadId: string;
  /** Where the browser sends the bytes. */
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  /** Epoch milliseconds. Short, so a leaked target can't be used to fill the storage. */
  expiresAt: number;
}

/** Long enough for a photo on hotel wifi, short enough that a target which leaks is soon useless. */
export const UPLOAD_TARGET_TTL_MS = 10 * 60 * 1000;

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
  /** Permission to send one file for one place, good for one content type and a few minutes. */
  createUploadTarget(request: UploadRequest): Promise<UploadTarget>;
  /**
   * Records an arrived file as a photo of the place its target was scoped to, and spends the target.
   * Null when the id is unknown or has expired, or when its bytes never arrived: the place the
   * photo belongs to comes from the target, never from whoever confirms it.
   */
  finalizeUpload(uploadId: string, details: Omit<NewPhoto, "placeId">): Promise<Photo | null>;
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
