"use client";

import dynamic from "next/dynamic";

/** Three.js needs the browser, so the globe skips server rendering. */
export const LazyGlobe = dynamic(() => import("./JourneyGlobe"), {
  ssr: false,
  loading: () => (
    <div className="globe-loading" aria-live="polite">
      Drawing the world
    </div>
  ),
});
