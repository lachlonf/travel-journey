"use client";

import { useActionState } from "react";
import type { CommandResult } from "@/lib/admin-commands";
import type { Trip } from "@/lib/types";
import { createTrip } from "./actions";
import { FormStatus } from "./FormStatus";

export function TripForm() {
  const [result, action, pending] = useActionState<CommandResult<Trip> | null, FormData>(createTrip, null);

  return (
    <form action={action} className="form">
      <div className="form-row">
        <div className="field">
          <label htmlFor="trip-name">Name</label>
          <input id="trip-name" name="name" className="input" required placeholder="South America 2025" />
        </div>
        <div className="field">
          <label htmlFor="trip-start">Starts</label>
          <input id="trip-start" name="startDate" type="date" className="input" />
        </div>
        <div className="field">
          <label htmlFor="trip-end">Ends</label>
          <input id="trip-end" name="endDate" type="date" className="input" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="trip-story">Story</label>
        <textarea id="trip-story" name="story" className="input" placeholder="How it started. Blank lines start new paragraphs." />
      </div>
      <FormStatus
        error={result && !result.ok ? result.error.message : null}
        message={result?.ok ? `Added “${result.value.name}”.` : undefined}
      />
      <div>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Add trip"}
        </button>
      </div>
    </form>
  );
}
