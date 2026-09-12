"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { updateTrip } from "@/app/admin/actions";
import { FormStatus } from "@/app/admin/FormStatus";
import type { Trip } from "@/lib/types";

export function EditTripForm({ trip }: { trip: Trip }) {
  const router = useRouter();
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.startDate ?? "");
  const [endDate, setEndDate] = useState(trip.endDate ?? "");
  const [story, setStory] = useState(trip.story);
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus({});

    try {
      const result = await updateTrip({ id: trip.id, name, story, startDate: startDate || null, endDate: endDate || null });
      if (!result.ok) {
        setStatus({ error: result.error.message });
        return;
      }
      setStatus({ message: `Saved “${result.value.name}”.` });
      router.refresh();
    } catch (error) {
      setStatus({ error: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="edit-trip-name">Name</label>
          <input id="edit-trip-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="edit-trip-start">Starts</label>
          <input id="edit-trip-start" type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="edit-trip-end">Ends</label>
          <input id="edit-trip-end" type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="edit-trip-story">Story</label>
        <textarea
          id="edit-trip-story"
          className="input"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="How it started. Blank lines start new paragraphs."
        />
      </div>

      <FormStatus {...status} />
      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
