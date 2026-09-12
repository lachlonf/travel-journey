import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { loadJourneyData } from "@/lib/data";
import { plural } from "@/lib/format";
import { buildJourney, tripStops } from "@/lib/journey";
import { EditTripForm } from "./EditTripForm";

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");

  const [{ id }, data] = await Promise.all([params, loadJourneyData()]);
  const journey = buildJourney(data);
  const trip = journey.tripById.get(id);
  if (!trip) notFound();

  return (
    <main className="admin">
      <header className="admin-header">
        <div>
          <p className="kicker">Trip · {plural(tripStops(journey, trip.id).length, "place")}</p>
          <h1>{trip.name}</h1>
        </div>
        <nav>
          <Link className="btn" href="/admin">
            Back to admin
          </Link>
        </nav>
      </header>

      <section className="admin-section">
        <h2>Details</h2>
        <EditTripForm trip={trip} />
      </section>
    </main>
  );
}
