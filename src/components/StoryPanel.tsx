import Link from "next/link";
import { formatDate, paragraphs, plural } from "@/lib/format";
import type { Journey } from "@/lib/journey";

interface StoryPanelProps {
  journey: Journey;
  placeId: string;
  /** In explore mode, offer a way into the trip's story. Story mode is already in it. */
  showTripLink?: boolean;
  onClose?: () => void;
  onOpenPlace?: (placeId: string) => void;
}

/** A place's story, read top to bottom like a journal entry. */
export function StoryPanel({ journey, placeId, showTripLink = false, onClose, onOpenPlace }: StoryPanelProps) {
  const place = journey.placeById.get(placeId);
  const city = journey.cityOf.get(placeId);
  if (!place || !city) return null;

  const country = journey.countryByCode.get(city.place.countryCode);
  const trip = place.tripId ? journey.tripById.get(place.tripId) : undefined;
  // Blank text blocks would only leave a gap.
  const story = (journey.storyByPlace.get(place.id) ?? []).filter((block) => block.type === "photo" || paragraphs(block.text).length > 0);
  const nearby = place.kind === "city" ? city.spots : [city.place, ...city.spots.filter((p) => p.id !== place.id)];
  const where = [place.kind === "spot" ? city.place.name : null, country?.name].filter(Boolean).join(", ");

  return (
    <article className="story-panel" aria-labelledby="story-title">
      <div className="story-top">
        <p className="kicker">{where}</p>
        {onClose && (
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <div className="story-inner">
        <h2 id="story-title" className="story-title">
          {place.name}
        </h2>
        {place.visitedOn.length > 0 && <p className="story-meta">{place.visitedOn.map(formatDate).join(" · ")}</p>}
        {showTripLink && trip && (
          <Link className="trip-badge" href={`/trips/${trip.id}?stop=${place.id}`}>
            Part of {trip.name}: follow the story →
          </Link>
        )}

        {story.map((block, i) =>
          block.type === "text" ? (
            <div key={i} className="story-body">
              {paragraphs(block.text).map((paragraph, j) => (
                <p key={j}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <figure key={block.photo.id} className="story-photo">
              {/* Photos come from storage at arbitrary sizes, so a plain img rather than next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.photo.url} alt={block.photo.caption || place.name} loading="lazy" />
              {(block.photo.caption || block.photo.takenAt) && (
                <figcaption>{[block.photo.caption, block.photo.takenAt && formatDate(block.photo.takenAt)].filter(Boolean).join(" · ")}</figcaption>
              )}
            </figure>
          ),
        )}

        {story.length === 0 && <p className="story-empty">Nothing written here yet.</p>}

        {onOpenPlace && nearby.length > 0 && (
          <nav className="story-related" aria-label="Nearby">
            <p className="kicker">
              {place.kind === "city" ? `${plural(nearby.length, "spot")} around ${place.name}` : `Also around ${city.place.name}`}
            </p>
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
        )}
      </div>
    </article>
  );
}
