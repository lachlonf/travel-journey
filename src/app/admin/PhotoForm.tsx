"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { plural } from "@/lib/format";
import { FormStatus } from "./FormStatus";
import { countFailed, PhotoPicker, releasePreviews, uploadPhotos, type PendingPhoto } from "./photos";

export function PhotoForm({ places }: { places: { id: string; label: string }[] }) {
  const router = useRouter();
  const [placeId, setPlaceId] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  const [busy, setBusy] = useState(false);

  if (places.length === 0) return <p className="muted">Add a place first.</p>;

  const failed = countFailed(photos);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photos.length) {
      setStatus({ error: "Choose some photos first." });
      return;
    }
    setBusy(true);
    setStatus({});
    try {
      // Photos already up are skipped, so this is both the first send and the retry.
      const sending = photos.filter((p) => p.progress.state !== "done").length;
      const stillFailing = await uploadPhotos(placeId, photos, setPhotos);
      router.refresh();

      if (stillFailing) {
        setStatus({ error: `${plural(stillFailing, "photo")} didn’t go up. Their captions are kept, so you can retry them.` });
        return;
      }
      releasePreviews(photos);
      setPhotos([]);
      setStatus({ message: `Added ${plural(sending, "photo")}.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="photo-place">Place</label>
        <select id="photo-place" className="input" value={placeId} onChange={(e) => setPlaceId(e.target.value)} required disabled={busy}>
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
      <PhotoPicker id="photo-files" label="Photos" photos={photos} onChange={setPhotos} busy={busy} />
      <FormStatus {...status} />
      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Uploading…" : failed ? `Retry ${plural(failed, "photo")}` : "Upload"}
        </button>
      </div>
    </form>
  );
}
