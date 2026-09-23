import type { Journey } from "@/lib/journey";
import { Nearby, StoryBlocks, storyOf, TripLink, Visits } from "./story";

interface StoryPanelProps {
  journey: Journey;
  placeId: string;
  /** In explore mode, offer a way into the trip's story. Story mode is already in it. */
  showTripLink?: boolean;
  onClose?: () => void;
  /** The way out of the preview and into the full page, where the story has room. */
  onRead?: () => void;
  onOpenPlace?: (placeId: string) => void;
}

/**
 * The preview: click a pin, see what the place is, without committing to reading
 * it. The story itself is read as a full page — see `StoryPage`.
 */
export function StoryPanel({ journey, placeId, showTripLink = false, onClose, onRead, onOpenPlace }: StoryPanelProps) {
  const story = storyOf(journey, placeId);
  if (!story) return null;
  const { place, trip, blocks } = story;

  return (
    <article className="story-panel" aria-labelledby="story-title">
      <div className="story-top">
        <p className="kicker">{story.where}</p>
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
        <Visits place={place} />
        {showTripLink && trip && <TripLink trip={trip} placeId={place.id} />}

        {onRead && (
          <p className="story-read">
            <button type="button" className="btn btn-primary" onClick={onRead}>
              Read the story →
            </button>
          </p>
        )}

        <StoryBlocks blocks={blocks} alt={place.name} />

        {onOpenPlace && <Nearby story={story} onOpenPlace={onOpenPlace} />}
      </div>
    </article>
  );
}
