"use client";

import { useEffect, useRef, useState } from "react";
import type { CityResult } from "@/app/api/cities/route";
import { isValidLatLng } from "@/lib/geo";

/** Looks up the city nearest to typed coordinates once typing pauses. `onFound` decides what, if anything, it fills. */
export function useNearestCity(onFound?: (city: CityResult) => void) {
  const [nearest, setNearest] = useState<CityResult | null>(null);
  const lookup = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Nothing should still be pending once the form is gone.
  useEffect(() => () => clearTimeout(lookup.current), []);

  function suggest(latText: string, lngText: string) {
    clearTimeout(lookup.current);
    const [latitude, longitude] = [Number(latText), Number(lngText)];
    if (!latText.trim() || !lngText.trim() || !isValidLatLng(latitude, longitude)) return;

    lookup.current = setTimeout(async () => {
      const response = await fetch(`/api/cities?lat=${latitude}&lng=${longitude}`);
      if (!response.ok) return;
      const { nearest: city } = (await response.json()) as { nearest: CityResult | null };
      if (!city) return;
      setNearest(city);
      onFound?.(city);
    }, 350);
  }

  return { nearest, suggest, clear: () => setNearest(null) };
}
