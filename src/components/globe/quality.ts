export interface Quality {
  pixelRatio: number;
  /** Glyph cell size in drawing-buffer pixels. */
  cellSize: number;
  segments: number;
  maskWidth: number;
  atlas: "110m" | "50m";
}

/** Phones and low-core machines get a lighter globe rather than a different experience. */
export function detectQuality(): Quality {
  const light = window.matchMedia("(pointer: coarse)").matches || (navigator.hardwareConcurrency ?? 8) <= 4;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, light ? 1.5 : 2);

  return light
    ? { pixelRatio, cellSize: 9 * pixelRatio, segments: 64, maskWidth: 2048, atlas: "110m" }
    : { pixelRatio, cellSize: 8 * pixelRatio, segments: 128, maskWidth: 4096, atlas: "50m" };
}
