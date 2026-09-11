import Link from "next/link";
import { loadJourneyData } from "@/lib/data";
import { formatRange, plural } from "@/lib/format";
import { buildJourney, tripCountries, tripStops } from "@/lib/journey";

export default async function Home() {
  const journey = buildJourney(await loadJourneyData());
  const { trips, places } = journey.data;

  return (
    <main className="landing">
      <header>
        <p className="kicker">A travel journal · no feed, no likes</p>
        <h1>Where I’ve been.</h1>
        <p className="landing-lede">
          {plural(journey.countries.length, "country", "countries")} · {plural(places.length, "place")}
        </p>
      </header>

      <Link href="/explore" className="choice">
        <span className="choice-arrow" aria-hidden="true">
          →
        </span>
        <strong>Explore freely</strong>
        <span>Spin the globe and open any place, in any order.</span>
      </Link>

      <section aria-labelledby="trips-title">
        <h2 id="trips-title" className="kicker section-title">
          Or follow a trip
        </h2>
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
      </section>
    </main>
  );
}
