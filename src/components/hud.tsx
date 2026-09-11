import Link from "next/link";
import { formatRange, plural } from "@/lib/format";
import type { CountryNode, Journey } from "@/lib/journey";
import type { Nav } from "@/lib/navigation";

export function Breadcrumbs({ journey, nav, onBack }: { journey: Journey; nav: Nav; onBack: () => void }) {
  const trail = ["World"];
  if (nav.level !== "world") trail.push(journey.countryByCode.get(nav.country)?.name ?? nav.country);
  if (nav.level === "city") trail.push(journey.placeById.get(nav.cityId)?.name ?? "");

  return (
    <nav className="crumbs" aria-label="Where you are">
      {nav.level !== "world" && (
        <button type="button" className="btn" onClick={onBack}>
          ← Back
        </button>
      )}
      <ol>
        {trail.map((step, i) => (
          <li key={i} aria-current={i === trail.length - 1 ? "location" : undefined}>
            {step}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The light country-level summary: name, when, how much, and the trips that passed through. */
export function CountrySummary({ journey, country }: { journey: Journey; country: CountryNode }) {
  const placeCount = country.cities.reduce((n, city) => n + 1 + city.pois.length, 0);
  const dates = country.dateRange && formatRange(country.dateRange.from, country.dateRange.to);
  const trips = country.tripIds.flatMap((id) => journey.tripById.get(id) ?? []);

  return (
    <aside className="country-summary">
      <p className="kicker">Unlocked</p>
      <h1>{country.name}</h1>
      <p className="muted">{[dates, plural(placeCount, "place")].filter(Boolean).join(" · ")}</p>
      {trips.length > 0 && (
        <ul>
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link href={`/trips/${trip.id}`}>{trip.name} →</Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
