/**
 * How a photograph rests on the paper. A print's tilt and size are derived from
 * its photo's id: never random, so the page doesn't rearrange itself on every
 * render and read as a bug, and never stored, so nobody has to decide.
 */

/** How wide a print rests, as a name the stylesheet draws. */
export type PrintSize = (typeof PRINT_SIZES)[number];

/** Narrowest first, so the order is the order a reader sees them grow in. */
export const PRINT_SIZES = ["narrow", "wide", "full"] as const;

/**
 * The buckets a print's width is drawn from, as repeats. Wide is the resting
 * width of a story and the other two are the variation around it, so a column
 * varies without either extreme becoming the rhythm.
 */
const SIZE_WEIGHTS: readonly PrintSize[] = ["narrow", "wide", "wide", "wide", "full", "full"];

/**
 * Degrees. The gentlest lean this derives: below it a print reads as a rendering
 * error rather than as a hand. A narrow screen scales every lean down together
 * (`--tilt-scale` in `globals.css`), which keeps the variety it can't keep the
 * angles of, so a rendered tilt can sit under this floor where a derived one can't.
 */
export const MIN_TILT = 0.4;
/**
 * Degrees. Above this a print reads as broken. It is also as far as a print has
 * room to lean: the stylesheet keeps `--swing` either side of a print for the
 * corner this throws out, so raising it means widening that too.
 */
export const MAX_TILT = 1.4;
/** The steps between the two, coarse enough that no two prints look near-identical. */
const TILT_STEP = 0.2;

export interface PrintGeometry {
  /** Degrees, signed: negative leans left. Never zero — a flat print is a grid. */
  tilt: number;
  size: PrintSize;
}

/**
 * How does this photograph rest on the page? Stable for the life of a photo id,
 * identical in every browser, and cheap enough to call while rendering.
 */
export function printGeometry(photoId: string): PrintGeometry {
  return {
    tilt: tiltFrom(hash(photoId, "tilt")),
    // Tilt and size are hashed apart so a print's lean says nothing about its width.
    size: SIZE_WEIGHTS[hash(photoId, "size") % SIZE_WEIGHTS.length],
  };
}

const TILT_STOPS = Math.round((MAX_TILT - MIN_TILT) / TILT_STEP) + 1;

function tiltFrom(value: number): number {
  const magnitude = MIN_TILT + (value % TILT_STOPS) * TILT_STEP;
  const leansLeft = Math.floor(value / TILT_STOPS) % 2 === 0;
  // Degrees land on a tenth, so the value is exact rather than 0.6000000000000001.
  return Math.round(magnitude * (leansLeft ? -10 : 10)) / 10;
}

/**
 * FNV-1a, 32-bit, over the id's UTF-16 code units. Chosen for being a handful of
 * integer operations with no platform behaviour in them: the same id gives the
 * same number in every browser, today and after any rebuild. The salt gives one
 * id several independent numbers.
 */
function hash(value: string, salt: string): number {
  let hashed = 0x811c9dc5;
  const input = `${salt}:${value}`;
  for (let i = 0; i < input.length; i++) {
    hashed ^= input.charCodeAt(i);
    hashed = Math.imul(hashed, 0x01000193);
  }
  return hashed >>> 0;
}
