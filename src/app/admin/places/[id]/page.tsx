import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { loadJourneyData } from "@/lib/data";
import { buildJourney, countryName } from "@/lib/journey";
import type { StoryBlock } from "@/lib/types";
import { EditPlaceForm } from "./EditPlaceForm";
import { StoryArranger } from "./StoryArranger";

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

  // The arranger starts from the story visitors read, so a photo no block mentions is in it, at the end.
  const story = journey.storyByPlace.get(place.id) ?? [];
  const blocks: StoryBlock[] = story.map((block) => (block.type === "text" ? block : { type: "photo", photoId: block.photo.id }));

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

      <section className="admin-section">
        <h2>Story</h2>
        <StoryArranger placeId={place.id} blocks={blocks} photos={data.photos.filter((p) => p.placeId === place.id)} />
      </section>
    </main>
  );
}
