import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { loadJourneyData } from "@/lib/data";
import { buildJourney, countryName } from "@/lib/journey";
import { EditPlaceForm } from "./EditPlaceForm";

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");

  const [{ id }, data] = await Promise.all([params, loadJourneyData()]);
  const journey = buildJourney(data);
  const place = journey.placeById.get(id);
  if (!place) notFound();

  // A spot whose city is missing is its own city node; it then has no parent to show.
  const city = journey.cityOf.get(place.id)!.place;
  const parentCity = place.kind === "poi" && city.id !== place.id ? city : null;
  const where = [parentCity?.name, countryName(place.countryCode)].filter(Boolean).join(", ");

  return (
    <main className="admin">
      <header className="admin-header">
        <div>
          <p className="kicker">
            {place.kind === "city" ? "City" : "Specific spot"} · {where}
          </p>
          <h1>{place.name}</h1>
        </div>
        <nav>
          <Link className="btn" href="/admin">
            Back to admin
          </Link>
        </nav>
      </header>

      <section className="admin-section">
        <h2>Details</h2>
        <EditPlaceForm place={place} parentCity={parentCity} trips={data.trips} />
      </section>
    </main>
  );
}
