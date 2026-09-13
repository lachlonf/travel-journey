"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { readPhotoMetadata, type PhotoMetadata } from "@/lib/exif";
import { plural } from "@/lib/format";
import { imageTypeForExtension, IMAGE_TYPES, isAllowedImageType, type UploadTarget } from "@/lib/repository/types";
import { confirmUpload, prepareUpload } from "./actions";

const MAX_EDGE_PX = 2400;
const ACCEPT = IMAGE_TYPES.join(",");

/** The bytes that actually go up, and the type the upload target has to be asked for. */
interface UploadBody {
  blob: Blob;
  contentType: string;
  /** False when this browser couldn't decode the photo, so it goes up exactly as it came off the camera. */
  converted: boolean;
}

/** How far one photo has got on its way up. */
export type PhotoProgress =
  | { state: "waiting" }
  | { state: "sending"; sent: number }
  | { state: "done" }
  | { state: "failed"; error: string };

export interface PendingPhoto {
  key: string;
  file: File;
  previewUrl: string;
  caption: string;
  /** Read before upload, because re-encoding strips EXIF. */
  meta: PhotoMetadata;
  /** Resized once, when the photo is picked, so retrying doesn't do that work again. */
  body: UploadBody;
  progress: PhotoProgress;
}

/**
 * What the photo is: what the browser says, or what its name says when the browser doesn't know the
 * format. A browser that can't decode HEIC often reports no type for it at all, and a photo with no
 * type would be turned away as an unsupported file rather than going up with a warning.
 */
function contentTypeOf(file: File): string {
  const type = file.type.toLowerCase();
  if (isAllowedImageType(type)) return type;
  return imageTypeForExtension(file.name.split(".").pop() ?? "") ?? type;
}

/** Resized and re-encoded so uploads are quick on mobile data, or the file as it is when this browser can't decode it. */
async function shrink(file: File): Promise<UploadBody> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((encoded) => (encoded ? resolve(encoded) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
    );
    return { blob, contentType: "image/jpeg", converted: true };
  } catch {
    // Formats this browser can't decode (HEIC outside Safari) go up as they are.
    return { blob: file, contentType: contentTypeOf(file), converted: false };
  }
}

/** HEIC that stayed HEIC shows on Apple devices and often nowhere else, which the owner should hear now, not later. */
const mayNotDisplay = (photo: PendingPhoto) => !photo.body.converted && photo.body.contentType === "image/heic";

export const countFailed = (photos: readonly PendingPhoto[]) => photos.filter((p) => p.progress.state === "failed").length;

export const releasePreviews = (photos: readonly PendingPhoto[]) => photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));

/**
 * The bytes going straight to storage, reported as they go: fetch can't say how far along an upload is,
 * and on hotel wifi a photo that's half up is worth knowing about. Resolves with what went wrong, or null.
 */
function sendBytes(target: UploadTarget, body: Blob, onSent: (fraction: number) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open(target.method, target.url);
    for (const [name, value] of Object.entries(target.headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onSent(event.loaded / event.total);
    };
    request.onload = () => resolve(request.status >= 200 && request.status < 300 ? null : `the upload was turned away (${request.status})`);
    request.onerror = () => resolve("the connection dropped");
    request.ontimeout = () => resolve("it took too long");
    // Every way a request can end resolves this, so a photo can never sit half-sent forever.
    request.onabort = () => resolve("the upload was stopped");
    request.send(body);
  });
}

/** One photo's whole way up: permission to send, the bytes themselves, then recording it. */
async function sendPhoto(placeId: string, photo: PendingPhoto, onSent: (fraction: number) => void): Promise<string | null> {
  const prepared = await prepareUpload({ placeId, contentType: photo.body.contentType });
  if (!prepared.ok) return prepared.error.message;

  const failure = await sendBytes(prepared.value, photo.body.blob, onSent);
  if (failure) return failure;

  const confirmed = await confirmUpload({
    uploadId: prepared.value.uploadId,
    caption: photo.caption,
    takenAt: photo.meta.takenAt,
    lat: photo.meta.lat,
    lng: photo.meta.lng,
  });
  return confirmed.ok ? null : confirmed.error.message;
}

/**
 * Sends every photo that isn't up yet, one at a time, marking each as it goes so the owner can see
 * where it's got to. Photos already up are left alone, so retrying can't record one of them twice.
 * Returns how many failed, which is how many there are to retry.
 */
export async function uploadPhotos(
  placeId: string,
  photos: readonly PendingPhoto[],
  onChange: Dispatch<SetStateAction<PendingPhoto[]>>,
): Promise<number> {
  let failed = 0;
  for (const photo of photos.filter((p) => p.progress.state !== "done")) {
    const mark = (progress: PhotoProgress) => onChange((current) => current.map((p) => (p.key === photo.key ? { ...p, progress } : p)));

    mark({ state: "sending", sent: 0 });
    const error = await sendPhoto(placeId, photo, (sent) => mark({ state: "sending", sent }));
    if (error) failed += 1;
    // Everything the retry needs is already here: the caption is never asked for again.
    mark(error ? { state: "failed", error } : { state: "done" });
  }
  return failed;
}

/** What one photo's tile says about where it's got to. */
function ProgressNote({ progress }: { progress: PhotoProgress }) {
  if (progress.state === "failed") return <p className="photo-note photo-note-error">Didn’t go up: {progress.error}</p>;
  if (progress.state === "done") return <p className="photo-note photo-note-done">Uploaded.</p>;
  if (progress.state !== "sending") return null;

  const percent = Math.round(progress.sent * 100);
  return (
    <div className="photo-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
      <span style={{ width: `${percent}%` }} />
      <em>{percent}%</em>
    </div>
  );
}

interface PhotoPickerProps {
  id: string;
  label: string;
  photos: PendingPhoto[];
  onChange: Dispatch<SetStateAction<PendingPhoto[]>>;
  onAdded?: (added: PendingPhoto[]) => void;
  /** While photos are going up: captions are on their way, so they stop being editable. */
  busy?: boolean;
}

export function PhotoPicker({ id, label, photos, onChange, onAdded, busy = false }: PhotoPickerProps) {
  /** Reading and resizing take a moment on a phone, so the wait is visible rather than nothing happening. */
  const [preparing, setPreparing] = useState(0);

  async function add(files: File[]) {
    if (!files.length) return;
    setPreparing((count) => count + files.length);
    try {
      const added = await Promise.all(
        files.map(async (file) => ({
          key: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          caption: "",
          // The metadata comes off the file first: resizing re-encodes it, which strips EXIF.
          meta: await readPhotoMetadata(file),
          body: await shrink(file),
          progress: { state: "waiting" } as PhotoProgress,
        })),
      );
      onChange((current) => [...current, ...added]);
      onAdded?.(added);
    } finally {
      setPreparing((count) => count - files.length);
    }
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
        disabled={busy}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          void add(files);
        }}
      />
      {preparing > 0 && <p className="hint">Getting {plural(preparing, "photo")} ready…</p>}
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
                <button type="button" disabled={busy} onClick={() => remove(photo)} aria-label={`Remove ${photo.file.name}`}>
                  ✕
                </button>
              </div>
              <ProgressNote progress={photo.progress} />
              {mayNotDisplay(photo) && (
                <p className="photo-note photo-note-warn">
                  This browser can’t convert HEIC, so it goes up as it is. It may not display for visitors on non-Apple devices.
                </p>
              )}
              <input
                className="input"
                placeholder="Caption"
                value={photo.caption}
                readOnly={busy}
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
