import { plural } from "@/lib/format";
import type { Journey } from "@/lib/journey";

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
