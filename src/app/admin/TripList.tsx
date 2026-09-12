"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatRange, plural } from "@/lib/format";
import type { Trip } from "@/lib/types";
import { deleteTrip } from "./actions";
import { FormStatus } from "./FormStatus";

export interface AdminTrip {
  trip: Trip;
  /** How many places are on it, so dissolving one can say what it lets go of. */
  stops: number;
}

export function TripList({ trips }: { trips: AdminTrip[] }) {
  return (
    <ul className="admin-list">
      {trips.map(({ trip, stops }) => (
        <li key={trip.id}>
          <Link className="admin-list-name" href={`/admin/trips/${trip.id}`}>
            {trip.name}
          </Link>
          <span className="muted">{[formatRange(trip.startDate, trip.endDate), plural(stops, "place")].filter(Boolean).join(" · ")}</span>
          <DeleteTrip trip={trip} stops={stops} />
        </li>
      ))}
    </ul>
  );
}

/** Deleting is two taps: dissolving a trip is easy to do by accident and there's no undo. */
function DeleteTrip({ trip, stops }: AdminTrip) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const result = await deleteTrip(trip.id);
      if (!result.ok) {
        setError(result.error.message);
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className="admin-list-actions">
        <FormStatus error={error} />
        <button className="btn" type="button" onClick={() => setConfirming(true)}>
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className="admin-list-actions">
      <span className="hint">
        Dissolve “{trip.name}”?{stops > 0 && ` ${plural(stops, "place")} will stay on the globe.`}
      </span>
      <button className="btn" type="button" onClick={() => setConfirming(false)} disabled={busy}>
        Keep
      </button>
      <button className="btn btn-danger" type="button" onClick={remove} disabled={busy}>
        {busy ? "Deleting…" : "Delete trip"}
      </button>
    </div>
  );
}
