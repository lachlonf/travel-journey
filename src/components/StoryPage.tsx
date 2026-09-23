import { useEffect, useRef } from "react";
import type { Journey } from "@/lib/journey";
import { Nearby, StoryBlocks, storyOf, TripLink, Visits } from "./story";

interface StoryPageProps {
  journey: Journey;
  placeId: string;
  onClose: () => void;
  onOpenPlace: (placeId: string) => void;
}

/**
 * Reading: the story takes over the screen, so the writing and the photographs
 * have the width of the page rather than a column narrower than a phone is tall.
 * The globe is left untouched underneath, and closing returns to the preview.
 */
export function StoryPage({ journey, placeId, onClose, onOpenPlace }: StoryPageProps) {
  const top = useRef<HTMLElement>(null);
  const story = storyOf(journey, placeId);

  // Every story starts at its own beginning, including one opened from halfway down another.
  useEffect(() => {
    top.current?.focus();
    top.current?.scrollTo({ top: 0 });
  }, [placeId]);

  if (!story) return null;
  const { place, trip, blocks } = story;

  return (
    <article className="story-page" aria-labelledby="story-page-title" ref={top} tabIndex={-1}>
      <div className="story-page-top">
        <button type="button" className="btn" onClick={onClose}>
          ← Back
        </button>
      </div>

      <div className="story-page-inner">
        <header className="story-page-head">
          <p className="kicker">{story.where}</p>
          <h1 id="story-page-title" className="story-page-title">
            {place.name}
          </h1>
          <Visits place={place} />
          {trip && <TripLink trip={trip} placeId={place.id} />}
        </header>

        <StoryBlocks blocks={blocks} alt={place.name} />

        <Nearby story={story} onOpenPlace={onOpenPlace} />
      </div>
    </article>
  );
}
