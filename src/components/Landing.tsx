import { plural } from "@/lib/format";
import type { Journey } from "@/lib/journey";

/**
 * The landing: a title and the ways in, resting on the globe itself. Explore and
 * Trips sit level with each other, because following a trip is the way in for
 * the people the link is sent to — so a journey with no trips offers the one
 * door it has, rather than a second one painted on.
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
  const started = journey.countries.length > 0 || places.length > 0;

  return (
    <section className="landing" aria-labelledby="landing-title">
      <div className="landing-scroll">
        <header>
          <h1 id="landing-title">Where I’ve been.</h1>
          <p className="landing-lede">A travel journal. No feed, no likes.</p>
          <p className="landing-state">
            {started
              ? `${plural(journey.countries.length, "country", "countries")} · ${plural(places.length, "place")}`
              : "The first place hasn’t been added yet."}
          </p>
        </header>

        <div className="landing-choices">
          <button type="button" className="choice" onClick={onExplore}>
            <span className="choice-head">
              <strong>Explore freely</strong>
              <span className="choice-arrow" aria-hidden="true">
                →
              </span>
            </span>
            <span className="choice-sub">Spin the globe and open any place{trips.length ? ", in any order" : ""}.</span>
          </button>
          {trips.length > 0 && (
            <button type="button" className="choice" onClick={onTrips}>
              <span className="choice-head">
                <strong>Follow a trip</strong>
                <span className="choice-arrow" aria-hidden="true">
                  →
                </span>
              </span>
              <span className="choice-sub">{plural(trips.length, "trip")}, each in the order I walked it.</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
