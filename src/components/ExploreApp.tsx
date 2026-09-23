"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildJourney } from "@/lib/journey";
import { exploringView, initialView, navigate, type NavAction } from "@/lib/navigation";
import type { JourneyData } from "@/lib/types";
import { LazyGlobe } from "./globe/LazyGlobe";
import { Breadcrumbs, CountrySummary } from "./hud";
import { Landing } from "./Landing";
import { StoryPage } from "./StoryPage";
import { StoryPanel } from "./StoryPanel";
import { TripsPanel } from "./TripsPanel";

/**
 * One globe, mounted once. The landing, the trips panel and a story panel are
 * all layers over it, so nothing here ever unmounts the world.
 */
export function ExploreApp({
  data,
  initialPlaceId,
  landing = false,
}: {
  data: JourneyData;
  initialPlaceId?: string;
  /** Whether this route carries the landing, or is the bare globe with a way back to it. */
  landing?: boolean;
}) {
  const journey = useMemo(() => buildJourney(data), [data]);
  const [view, setView] = useState(() => {
    const start = landing ? initialView : exploringView;
    return initialPlaceId ? navigate(journey, start, { type: "openPlace", placeId: initialPlaceId }) : start;
  });
  const dispatch = useCallback((action: NavAction) => setView((current) => navigate(journey, current, action)), [journey]);
  const back = useCallback(() => dispatch({ type: "back" }), [dispatch]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") back();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [back]);

  const { nav, openPlaceId, overlay, reading } = view;
  const country = nav.level === "country" ? journey.countryByCode.get(nav.country) : undefined;

  return (
    <main className="stage">
      {/* Inert while reading: the world is still there, but it is behind a page now. */}
      <div className="globe-shell" inert={reading}>
        <LazyGlobe journey={journey} nav={nav} panelOpen={openPlaceId !== null || overlay === "trips"} onNavigate={dispatch} />
      </div>

      {overlay === "landing" && (
        <Landing journey={journey} onExplore={() => dispatch({ type: "explore" })} onTrips={() => dispatch({ type: "openTrips" })} />
      )}
      {overlay === "trips" && <TripsPanel journey={journey} onClose={back} />}

      {overlay === null && !reading && (
        <header className="hud">
          {landing ? (
            <button type="button" className="hud-home" onClick={() => dispatch({ type: "landing" })}>
              Journey
            </button>
          ) : (
            <Link href="/" className="hud-home">
              Journey
            </Link>
          )}
          <Breadcrumbs journey={journey} nav={nav} onBack={back} />
        </header>
      )}

      {overlay === null && nav.level === "world" && journey.countries.length === 0 && <p className="hud-empty">Nothing unlocked yet.</p>}
      {country && <CountrySummary journey={journey} country={country} />}
      {openPlaceId && !reading && (
        <StoryPanel
          key={openPlaceId}
          journey={journey}
          placeId={openPlaceId}
          showTripLink
          onClose={back}
          onRead={() => dispatch({ type: "readStory" })}
          onOpenPlace={(placeId) => dispatch({ type: "openPlace", placeId })}
        />
      )}
      {openPlaceId && reading && (
        <StoryPage
          journey={journey}
          placeId={openPlaceId}
          onClose={back}
          onOpenPlace={(placeId) => dispatch({ type: "openPlace", placeId })}
        />
      )}
    </main>
  );
}
