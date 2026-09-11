"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { plural } from "@/lib/format";
import { FormStatus } from "./FormStatus";
import { PhotoPicker, releasePreviews, uploadPhotos, type PendingPhoto } from "./photos";

export function PhotoForm({ places }: { places: { id: string; label: string }[] }) {
  const router = useRouter();
  const [placeId, setPlaceId] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  const [busy, setBusy] = useState(false);

  if (places.length === 0) return <p className="muted">Add a place first.</p>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photos.length) {
      setStatus({ error: "Choose some photos first." });
      return;
    }
    setBusy(true);
    setStatus({});
    try {
      const failed = await uploadPhotos(placeId, photos, (i, total) => setStatus({ message: `Uploading photo ${i + 1} of ${total}…` }));
      releasePreviews(photos);
      setPhotos([]);
      setStatus(failed.length ? { error: `Some photos failed: ${failed.join(", ")}` } : { message: `Added ${plural(photos.length, "photo")}.` });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="photo-place">Place</label>
        <select id="photo-place" className="input" value={placeId} onChange={(e) => setPlaceId(e.target.value)} required>
          <option value="" disabled>
            Choose a place
          </option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.label}
            </option>
          ))}
        </select>
      </div>
      <PhotoPicker id="photo-files" label="Photos" photos={photos} onChange={setPhotos} />
      <FormStatus {...status} />
      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
