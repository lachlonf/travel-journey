"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePhoto, updatePhotoCaption } from "@/app/admin/actions";
import { FormStatus } from "@/app/admin/FormStatus";
import type { CommandResult } from "@/lib/admin-commands";
import type { Photo } from "@/lib/types";

/** The captions being written, and the saved ones they were seeded from. */
interface Captions {
  byId: Record<string, string>;
  seeded: string;
}

const savedCaptions = (photos: Photo[]) => JSON.stringify(photos.map((p) => [p.id, p.caption]));

const seed = (photos: Photo[]): Captions => ({
  byId: Object.fromEntries(photos.map((p) => [p.id, p.caption])),
  seeded: savedCaptions(photos),
});

/** A place's photos, in the order its story shows them: say something new about one, or remove it for good. */
export function PhotoEditor({ placeId, photos }: { placeId: string; photos: Photo[] }) {
  const router = useRouter();
  const [captions, setCaptions] = useState<Captions>(() => seed(photos));
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  /** Which photo is mid-save or mid-delete, so only its own buttons wait. */
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Seeding again rather than remounting keeps the confirmation of the save that caused it on screen.
  const saved = savedCaptions(photos);
  if (captions.seeded !== saved) setCaptions(seed(photos));

  /** Runs one photo's change, reporting whatever the command says about it. */
  async function run(photoId: string, work: () => Promise<CommandResult<Photo>>, done: string) {
    setBusy(photoId);
    setStatus({});
    try {
      const result = await work();
      if (!result.ok) {
        setStatus({ error: result.error.message });
        setConfirming(null);
        return;
      }
      setStatus({ message: done });
      setConfirming(null);
      // The page hands back the photos as they now are, which seeds the captions again.
      router.refresh();
    } catch (error) {
      setStatus({ error: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  }

  if (photos.length === 0) return <p className="muted">No photos yet. Add some from the admin page.</p>;

  return (
    <div className="form">
      <p className="hint">Deleting a photo deletes its file and takes it out of the story. There’s no undo.</p>

      <ul className="photo-grid">
        {photos.map((photo, index) => {
          // What the buttons call this photo, so each one says which photo it acts on.
          const what = photo.caption || `photo ${index + 1}`;
          const caption = captions.byId[photo.id] ?? "";

          return (
            <li key={photo.id} className="photo-item">
              {/* Photos come from storage at arbitrary sizes, so a plain img rather than next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" />
              <input
                className="input"
                value={caption}
                placeholder="Caption"
                aria-label={`Caption for ${what}`}
                onChange={(event) => {
                  const written = event.target.value;
                  setCaptions((current) => ({ ...current, byId: { ...current.byId, [photo.id]: written } }));
                }}
              />

              <div className="block-actions">
                {confirming === photo.id ? (
                  <>
                    <button className="btn" type="button" disabled={busy === photo.id} onClick={() => setConfirming(null)}>
                      Keep
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      disabled={busy === photo.id}
                      onClick={() => run(photo.id, () => deletePhoto({ placeId, photoId: photo.id }), "Photo deleted.")}
                    >
                      {busy === photo.id ? "Deleting…" : "Delete for good"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn"
                      type="button"
                      aria-label={`Save the caption for ${what}`}
                      disabled={busy === photo.id || caption === photo.caption}
                      onClick={() => run(photo.id, () => updatePhotoCaption({ placeId, photoId: photo.id, caption }), "Caption saved.")}
                    >
                      {busy === photo.id ? "Saving…" : "Save caption"}
                    </button>
                    {/* Deleting is two taps: a photo and its file don't come back. */}
                    <button className="btn btn-danger" type="button" aria-label={`Delete ${what}`} onClick={() => setConfirming(photo.id)}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <FormStatus {...status} />
    </div>
  );
}
