import Link from "next/link";
import type { CSSProperties } from "react";
import { formatDate, paragraphs, plural } from "@/lib/format";
import type { Journey, ResolvedStoryBlock } from "@/lib/journey";
import { printGeometry } from "@/lib/print";
import type { Photo, Place, Trip } from "@/lib/types";

/** Everything a story needs to be told, whether as a preview or as a full page. */
export interface Story {
  place: Place;
  /** The city the place is, or the city a spot folds into. */
  city: Place;
  /** "Huaraz, Peru": where the place is, for the kicker above its name. */
  where: string;
  trip: Trip | undefined;
  blocks: ResolvedStoryBlock[];
  /** The other places around the same city. */
  nearby: Place[];
}

export function storyOf(journey: Journey, placeId: string): Story | null {
  const place = journey.placeById.get(placeId);
  const node = journey.cityOf.get(placeId);
  if (!place || !node) return null;

  const country = journey.countryByCode.get(node.place.countryCode);
  return {
    place,
    city: node.place,
    where: [place.kind === "spot" ? node.place.name : null, country?.name].filter(Boolean).join(", "),
    trip: place.tripId ? journey.tripById.get(place.tripId) : undefined,
    // Blank text blocks would only leave a gap.
    blocks: (journey.storyByPlace.get(place.id) ?? []).filter((block) => block.type === "photo" || paragraphs(block.text).length > 0),
    nearby: place.kind === "city" ? node.spots : [node.place, ...node.spots.filter((p) => p.id !== place.id)],
  };
}

/** The dates a place was visited, which return visits make a list of. */
export const Visits = ({ place }: { place: Place }) =>
  place.visitedOn.length > 0 ? <p className="story-meta">{place.visitedOn.map(formatDate).join(" · ")}</p> : null;

/** The way from a place into the trip it belongs to, which never redirects on its own. */
export const TripLink = ({ trip, placeId }: { trip: Trip; placeId: string }) => (
  <Link className="trip-badge" href={`/trips/${trip.id}?stop=${placeId}`}>
    Part of {trip.name}: follow the story →
  </Link>
);

/**
 * A story in the order it was written: one element per block, in block order, so
 * a screen reader hears exactly what a reader sees however the prints are laid out.
 */
export function StoryBlocks({ blocks, alt }: { blocks: ResolvedStoryBlock[]; alt: string }) {
  if (blocks.length === 0) return <p className="story-empty">Nothing written here yet.</p>;

  return blocks.map((block, i) =>
    block.type === "text" ? (
      <div key={i} className="story-body">
        {paragraphs(block.text).map((paragraph, j) => (
          <p key={j}>{paragraph}</p>
        ))}
      </div>
    ) : (
      <Print key={block.photo.id} photo={block.photo} alt={alt} />
    ),
  );
}

/**
 * One photograph resting on the paper: matted, faintly shadowed, and tilted by
 * the hand that laid it down. The tilt and the width come from the photo's id,
 * so a print sits exactly where it sat last time (see `printGeometry`).
 */
function Print({ photo, alt }: { photo: Photo; alt: string }) {
  const { tilt, size } = printGeometry(photo.id);
  const caption = [photo.caption, photo.takenAt && formatDate(photo.takenAt)].filter(Boolean).join(" · ");

  return (
    <figure className="print" data-print={size} style={{ "--tilt": `${tilt}deg` } as CSSProperties}>
      <div className="print-mat">
        {/* Photos come from storage at arbitrary sizes, so a plain img rather than next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption || alt} loading="lazy" />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** The places around this one, as a way on rather than back out to the globe. */
export function Nearby({ story, onOpenPlace }: { story: Story; onOpenPlace: (placeId: string) => void }) {
  const { place, city, nearby } = story;
  if (nearby.length === 0) return null;

  return (
    <nav className="story-related" aria-label="Nearby">
      <p className="kicker">{place.kind === "city" ? `${plural(nearby.length, "spot")} around ${place.name}` : `Also around ${city.name}`}</p>
      <ul>
        {nearby.map((p) => (
          <li key={p.id}>
            <button type="button" className="btn" onClick={() => onOpenPlace(p.id)}>
              {p.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
