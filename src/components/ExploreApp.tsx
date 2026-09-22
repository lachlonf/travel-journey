"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildJourney } from "@/lib/journey";
import { initialView, navigate, type NavAction } from "@/lib/navigation";
import type { JourneyData } from "@/lib/types";
import { LazyGlobe } from "./globe/LazyGlobe";
import { PrototypeSwitcher } from "./globe/PrototypeSwitcher";
import { asVariant, type VariantKey } from "./globe/prototype-unlock";
import { Breadcrumbs, CountrySummary } from "./hud";
import { StoryPanel } from "./StoryPanel";

export function ExploreApp({ data, initialPlaceId }: { data: JourneyData; initialPlaceId?: string }) {
  const journey = useMemo(() => buildJourney(data), [data]);
  const [view, setView] = useState(() =>
    initialPlaceId ? navigate(journey, initialView, { type: "openPlace", placeId: initialPlaceId }) : initialView,
  );
  // PROTOTYPE (#18): `?variant=` picks the unlock treatment. Read from the URL so it is shareable.
  // Read once on mount rather than during render: the globe is client-only anyway.
  const [variant, setVariant] = useState<VariantKey>(() =>
    typeof location === "undefined" ? "A" : asVariant(new URLSearchParams(location.search).get("variant")),
  );
  const chooseVariant = useCallback((next: VariantKey) => {
    const url = new URL(location.href);
    url.searchParams.set("variant", next);
    history.replaceState(null, "", url);
    setVariant(next);
  }, []);

  const dispatch = useCallback((action: NavAction) => setView((current) => navigate(journey, current, action)), [journey]);
  const back = useCallback(() => dispatch({ type: "back" }), [dispatch]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") back();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [back]);

  const { nav, openPlaceId } = view;
  const country = nav.level === "country" ? journey.countryByCode.get(nav.country) : undefined;

  return (
    <main className="stage">
      <LazyGlobe journey={journey} nav={nav} panelOpen={openPlaceId !== null} onNavigate={dispatch} variant={variant} />
      <PrototypeSwitcher current={variant} onChange={chooseVariant} />

      <header className="hud">
        <Link href="/" className="hud-home">
          Journey
        </Link>
        <Breadcrumbs journey={journey} nav={nav} onBack={back} />
      </header>

      {nav.level === "world" && journey.countries.length === 0 && <p className="hud-empty">Nothing unlocked yet.</p>}
      {country && <CountrySummary journey={journey} country={country} />}
      {openPlaceId && (
        <StoryPanel
          key={openPlaceId}
          journey={journey}
          placeId={openPlaceId}
          showTripLink
          onClose={back}
          onOpenPlace={(placeId) => dispatch({ type: "openPlace", placeId })}
        />
      )}
    </main>
  );
}
