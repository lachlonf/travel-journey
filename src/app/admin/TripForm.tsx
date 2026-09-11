"use client";

import { useActionState } from "react";
import { createTrip, type FormState } from "./actions";
import { FormStatus } from "./FormStatus";

const initialState: FormState = { error: null };

export function TripForm() {
  const [state, action, pending] = useActionState(createTrip, initialState);

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
      <FormStatus error={state.error} message={state.message} />
      <div>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Add trip"}
        </button>
      </div>
    </form>
  );
}
