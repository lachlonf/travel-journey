"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Journey } from "@/lib/journey";
import { cameraTarget, visiblePins, type Nav, type NavAction, type Pin } from "@/lib/navigation";
import { createGlobeEngine, supportsWebGL, type GlobeEngine } from "./engine";

export interface JourneyGlobeProps {
  journey: Journey;
  nav: Nav;
  /** Shifts the globe out from under the story panel. */
  panelOpen: boolean;
  /** On phones, extra height above the bottom sheet that's covered by other controls. */
  sheetReserveRem?: number;
  onNavigate: (action: NavAction) => void;
}

function actionFor(pin: Pin, nav: Nav): NavAction {
  if (pin.kind === "country") return { type: "openCountry", country: pin.id };
  if (pin.kind === "city" && nav.level === "country") return { type: "openCity", cityId: pin.id };
  return { type: "openPlace", placeId: pin.id };
}

export default function JourneyGlobe({ journey, nav, panelOpen, sheetReserveRem = 0, onNavigate }: JourneyGlobeProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const pinElements = useRef(new Map<string, HTMLElement>());
  const latest = useRef({ journey, onNavigate });
  const [webgl] = useState(supportsWebGL);
  const pins = useMemo(() => visiblePins(journey, nav), [journey, nav]);

  useEffect(() => {
    latest.current = { journey, onNavigate };
  });

  useEffect(() => {
    if (!webgl || !hostRef.current) return;
    const engine = createGlobeEngine(hostRef.current, {
      onCountryClick: (country) => latest.current.onNavigate({ type: "openCountry", country }),
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [webgl]);

  useEffect(() => {
    engineRef.current?.setUnlocked(journey.countries);
  }, [journey]);

  // Before the flight effect: the flight frames places around whatever the panel covers.
  useEffect(() => {
    engineRef.current?.setPanelOpen(panelOpen, sheetReserveRem);
  }, [panelOpen, sheetReserveRem]);

  // Only a change of place flies the camera, not fresh data for the same place.
  useEffect(() => {
    engineRef.current?.flyTo(cameraTarget(latest.current.journey, nav));
  }, [nav]);

  useEffect(() => {
    engineRef.current?.setPins(pins, pinElements.current);
  }, [pins]);

  if (!webgl) {
    return (
      <div className="globe-fallback">
        <p className="muted">This browser can’t draw the globe, but every place is still here.</p>
        <ul>
          {journey.countries.map((country) => (
            <li key={country.code}>
              <p className="kicker">{country.name}</p>
              <ul>
                {country.cities.map(({ place }) => (
                  <li key={place.id}>
                    <button type="button" className="btn" onClick={() => onNavigate({ type: "openPlace", placeId: place.id })}>
                      {place.name}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="globe">
      <div ref={hostRef} className="globe-canvas" />
      <div className="pin-layer">
        {pins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            className={`pin pin-${pin.kind}`}
            style={{ visibility: "hidden" }}
            ref={(element) => {
              if (element) pinElements.current.set(pin.id, element);
              else pinElements.current.delete(pin.id);
            }}
            onClick={() => onNavigate(actionFor(pin, nav))}
          >
            <span className="pin-dot" aria-hidden="true" />
            <span className="pin-label">{pin.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
