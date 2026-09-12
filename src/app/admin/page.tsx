import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { loadJourneyData } from "@/lib/data";
import { plural } from "@/lib/format";
import { buildJourney, tripStops } from "@/lib/journey";
import { logout } from "./actions";
import { PhotoForm } from "./PhotoForm";
import { PlaceForm } from "./PlaceForm";
import { TripForm } from "./TripForm";
import { TripList } from "./TripList";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const journey = buildJourney(await loadJourneyData());
  const photoCount = (placeId: string) => plural(journey.photosByPlace.get(placeId)?.length ?? 0, "photo");
  const placeOptions = journey.countries.flatMap((country) =>
    country.cities.flatMap((city) => [
      { id: city.place.id, label: `${country.name} · ${city.place.name}` },
      ...city.pois.map((poi) => ({ id: poi.id, label: `${country.name} · ${city.place.name} · ${poi.name}` })),
    ]),
  );

  return (
    <main className="admin">
      <header className="admin-header">
        <div>
          <p className="kicker">Journey</p>
          <h1>Admin</h1>
        </div>
        <nav>
          <Link className="btn" href="/explore">
            View the globe
          </Link>
          <form action={logout}>
            <button className="btn" type="submit">
              Log out
            </button>
          </form>
        </nav>
      </header>

      {!process.env.SUPABASE_URL && (
        <p className="hint">Saving to the local store in .data/journey.json. Connect Supabase before you deploy (see README).</p>
      )}

      <section className="admin-section">
        <h2>Add a trip</h2>
        <TripForm />
      </section>

      <section className="admin-section">
        <h2>Add a place</h2>
        <PlaceForm trips={journey.data.trips} />
      </section>

      <section className="admin-section">
        <h2>Add photos to a place</h2>
        <PhotoForm places={placeOptions} />
      </section>

      <section className="admin-section">
        <h2>Trips</h2>
        {journey.data.trips.length === 0 ? (
          <p className="muted">No trips yet.</p>
        ) : (
          <TripList trips={journey.data.trips.map((trip) => ({ trip, stops: tripStops(journey, trip.id).length }))} />
        )}
      </section>

      <section className="admin-section">
        <h2>On the map</h2>
        {journey.countries.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <>
            <p id="tree-hint" className="hint">
              Choose a place to edit it.
            </p>
            <ul className="tree" aria-describedby="tree-hint">
              {journey.countries.map((country) => (
                <li key={country.code}>
                  <strong>{country.name}</strong>
                  <ul>
                    {country.cities.map((city) => (
                      <li key={city.place.id}>
                        <Link href={`/admin/places/${city.place.id}`}>{city.place.name}</Link>{" "}
                        <span className="muted">· {photoCount(city.place.id)}</span>
                        {city.pois.length > 0 && (
                          <ul>
                            {city.pois.map((poi) => (
                              <li key={poi.id}>
                                <Link href={`/admin/places/${poi.id}`}>{poi.name}</Link> <span className="muted">· {photoCount(poi.id)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
