import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { loadJourneyData } from "@/lib/data";
import { plural } from "@/lib/format";
import { buildJourney } from "@/lib/journey";
import { logout } from "./actions";
import { PhotoForm } from "./PhotoForm";
import { PlaceForm } from "./PlaceForm";
import { TripForm } from "./TripForm";

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
        <h2>On the map</h2>
        {journey.countries.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul className="tree">
            {journey.countries.map((country) => (
              <li key={country.code}>
                <strong>{country.name}</strong>
                <ul>
                  {country.cities.map((city) => (
                    <li key={city.place.id}>
                      {city.place.name} <span className="muted">· {photoCount(city.place.id)}</span>
                      {city.pois.length > 0 && (
                        <ul>
                          {city.pois.map((poi) => (
                            <li key={poi.id}>
                              {poi.name} <span className="muted">· {photoCount(poi.id)}</span>
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
        )}
      </section>
    </main>
  );
}
