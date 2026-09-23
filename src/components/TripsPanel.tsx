import Link from "next/link";
import { formatRange, plural } from "@/lib/format";
import { type Journey, tripCountries, tripStops } from "@/lib/journey";

/** The trips list, laid over the same globe rather than on a page of its own. */
export function TripsPanel({ journey, onClose }: { journey: Journey; onClose: () => void }) {
  const { trips } = journey.data;

  return (
    <aside className="trips-panel" aria-labelledby="trips-title">
      <div className="story-top">
        <p className="kicker" id="trips-title">
          Follow a trip
        </p>
        <button type="button" className="btn" onClick={onClose}>
          ← Back
        </button>
      </div>

      <div className="story-inner">
        {trips.length === 0 ? (
          <p className="muted">No trips yet.</p>
        ) : (
          <ul className="trip-list">
            {trips.map((trip) => {
              const meta = [
                formatRange(trip.startDate, trip.endDate),
                tripCountries(journey, trip.id)
                  .map((c) => c.name)
                  .join(", "),
                plural(tripStops(journey, trip.id).length, "stop"),
              ];
              return (
                <li key={trip.id}>
                  <Link href={`/trips/${trip.id}`}>
                    <span className="trip-name">{trip.name}</span>
                    <span className="trip-meta">{meta.filter(Boolean).join(" · ")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
