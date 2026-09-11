"use client";

import type { Dispatch, SetStateAction } from "react";
import { readPhotoMetadata, type PhotoMetadata } from "@/lib/exif";
import { addPhoto } from "./actions";

export interface PendingPhoto {
  key: string;
  file: File;
  previewUrl: string;
  caption: string;
  /** Read before upload, because re-encoding strips EXIF. */
  meta: PhotoMetadata;
}

const MAX_EDGE_PX = 2400;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/heic";

/** Resize in the browser so uploads stay small (and under the host's request limit). */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
    );
  } catch {
    // Formats this browser can't decode (HEIC outside Safari) go up as they are.
    return file;
  }
}

/** Uploads one at a time and returns descriptions of any that failed. */
export async function uploadPhotos(
  placeId: string,
  photos: readonly PendingPhoto[],
  onProgress: (index: number, total: number) => void,
): Promise<string[]> {
  const failed: string[] = [];
  for (const [index, photo] of photos.entries()) {
    onProgress(index, photos.length);
    const body = new FormData();
    body.set("placeId", placeId);
    body.set("caption", photo.caption);
    body.set("file", await shrink(photo.file), photo.file.name);
    if (photo.meta.takenAt) body.set("takenAt", photo.meta.takenAt);
    if (photo.meta.lat !== null && photo.meta.lng !== null) {
      body.set("lat", String(photo.meta.lat));
      body.set("lng", String(photo.meta.lng));
    }
    try {
      const result = await addPhoto(body);
      if ("error" in result) failed.push(`${photo.file.name} (${result.error})`);
    } catch {
      failed.push(`${photo.file.name} (upload failed, possibly too large)`);
    }
  }
  return failed;
}

export const releasePreviews = (photos: readonly PendingPhoto[]) => photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));

interface PhotoPickerProps {
  id: string;
  label: string;
  photos: PendingPhoto[];
  onChange: Dispatch<SetStateAction<PendingPhoto[]>>;
  onAdded?: (added: PendingPhoto[]) => void;
}

export function PhotoPicker({ id, label, photos, onChange, onAdded }: PhotoPickerProps) {
  async function add(files: File[]) {
    if (!files.length) return;
    const added = await Promise.all(
      files.map(async (file) => ({
        key: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        caption: "",
        meta: await readPhotoMetadata(file),
      })),
    );
    onChange((current) => [...current, ...added]);
    onAdded?.(added);
  }

  function remove(photo: PendingPhoto) {
    URL.revokeObjectURL(photo.previewUrl);
    onChange((current) => current.filter((p) => p.key !== photo.key));
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept={ACCEPT}
        multiple
        className="input"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          void add(files);
        }}
      />
      {photos.length > 0 && (
        <ul className="photo-grid">
          {photos.map((photo) => (
            <li key={photo.key} className="photo-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.previewUrl} alt="" />
              <div className="photo-item-meta">
                <span>
                  {photo.meta.lat !== null ? "has location" : "no location"}
                  {photo.meta.takenAt ? ` · ${photo.meta.takenAt}` : ""}
                </span>
                <button type="button" onClick={() => remove(photo)} aria-label={`Remove ${photo.file.name}`}>
                  ✕
                </button>
              </div>
              <input
                className="input"
                placeholder="Caption"
                value={photo.caption}
                aria-label={`Caption for ${photo.file.name}`}
                onChange={(event) => {
                  const caption = event.target.value;
                  onChange((current) => current.map((p) => (p.key === photo.key ? { ...p, caption } : p)));
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
