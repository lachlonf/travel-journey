"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRange, paragraphs, plural } from "@/lib/format";
import { buildJourney, tripCountries, tripStops } from "@/lib/journey";
import { initialView, navigate, type NavAction } from "@/lib/navigation";
import type { JourneyData, Place } from "@/lib/types";
import { LazyGlobe } from "./globe/LazyGlobe";
import { StoryPanel } from "./StoryPanel";

/** Story mode: step through a trip's places in order, at your own pace. */
export function StoryApp({ data, tripId, startPlaceId }: { data: JourneyData; tripId: string; startPlaceId?: string }) {
  const journey = useMemo(() => buildJourney(data), [data]);
  const stops = useMemo(() => tripStops(journey, tripId), [journey, tripId]);
  // -1 is the trip's introduction.
  const [index, setIndex] = useState(() => stops.findIndex((stop) => stop.id === startPlaceId));
  const stop: Place | undefined = stops[index];
  const nav = useMemo(
    () => (stop ? navigate(journey, initialView, { type: "openPlace", placeId: stop.id }).nav : initialView.nav),
    [journey, stop],
  );

  const step = useCallback(
    (delta: number) => setIndex((i) => Math.max(-1, Math.min(stops.length - 1, i + delta))),
    [stops.length],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step]);

  // Clicking a pin that's on this trip jumps the story there; anything else is ignored.
  const onNavigate = useCallback(
    (action: NavAction) => {
      const id = action.type === "openPlace" ? action.placeId : action.type === "openCity" ? action.cityId : null;
      const i = id ? stops.findIndex((s) => s.id === id) : -1;
      if (i >= 0) setIndex(i);
    },
    [stops],
  );

  const trip = journey.tripById.get(tripId);
  if (!trip) return null;

  const countries = tripCountries(journey, tripId).map((c) => c.name);
  const dates = formatRange(trip.startDate, trip.endDate);
  const intro = paragraphs(trip.story);

  return (
    <main className="stage">
      {/* The story bar sits above the sheet on phones (see .story-bar in globals.css). */}
      <LazyGlobe journey={journey} nav={nav} panelOpen={Boolean(stop)} sheetReserveRem={5.5} onNavigate={onNavigate} />

      <header className="hud">
        <Link href="/" className="hud-home">
          Journey
        </Link>
        <Link href="/explore" className="btn">
          Explore freely
        </Link>
      </header>

      {!stop && (
        <section className="trip-intro" aria-labelledby="trip-title">
          <p className="kicker">{countries.length ? `A trip through ${countries.join(", ")}` : "A trip"}</p>
          <h1 id="trip-title">{trip.name}</h1>
          {dates && <p className="muted">{dates}</p>}
          {intro.length > 0 && (
            <div className="story-body">
              {intro.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          )}
          {stops.length === 0 && <p className="muted">No places on this trip yet.</p>}
        </section>
      )}

      {stop && <StoryPanel key={stop.id} journey={journey} placeId={stop.id} />}

      {stops.length > 0 && (
        <nav className="story-bar" data-sheet={Boolean(stop)} aria-label="Trip">
          <button type="button" className="btn" onClick={() => step(-1)} disabled={index < 0} aria-label="Previous">
            ←
          </button>
          <div className="story-bar-text">
            <p className="kicker">{trip.name}</p>
            <p>{stop ? `${index + 1} of ${stops.length} · ${stop.name}` : plural(stops.length, "stop")}</p>
            <div className="story-progress" aria-hidden="true">
              {stops.map((s, i) => (
                <span key={s.id} data-done={i <= index} />
              ))}
            </div>
          </div>
          {index === stops.length - 1 ? (
            <Link href="/explore" className="btn btn-primary">
              Explore →
            </Link>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => step(1)}>
              {stop ? "Next →" : "Begin →"}
            </button>
          )}
        </nav>
      )}
    </main>
  );
}
