import Link from "next/link";
import { formatRange, plural } from "@/lib/format";
import { type Journey, tripCountries, tripStops } from "@/lib/journey";

/**
 * The landing: a title and two choices resting on the globe itself. Explore and
 * Trips sit level with each other, because following a trip is the way in for
 * the people the link is sent to.
 */
export function Landing({
  journey,
  onExplore,
  onTrips,
}: {
  journey: Journey;
  onExplore: () => void;
  onTrips: () => void;
}) {
  const { trips, places } = journey.data;

  return (
    <section className="landing" aria-labelledby="landing-title">
      <header>
        <p className="kicker">A travel journal · no feed, no likes</p>
        <h1 id="landing-title">Where I’ve been.</h1>
        <p className="landing-lede">
          {plural(journey.countries.length, "country", "countries")} · {plural(places.length, "place")}
        </p>
      </header>

      <div className="landing-choices">
        <button type="button" className="choice" onClick={onExplore}>
          <span className="choice-arrow" aria-hidden="true">
            →
          </span>
          <strong>Explore freely</strong>
          <span>Spin the globe and open any place, in any order.</span>
        </button>
        <button type="button" className="choice" onClick={onTrips}>
          <span className="choice-arrow" aria-hidden="true">
            →
          </span>
          <strong>Follow a trip</strong>
          <span>{trips.length ? `${plural(trips.length, "trip")}, each in the order I walked it.` : "No trips yet."}</span>
        </button>
      </div>
    </section>
  );
}

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
