/**
 * The two colours the globe is drawn in. The glyph pass writes an opaque image
 * over the whole canvas, so its paper has to be the same paper the page rests
 * on: these are the stylesheet's `--paper` and `--ink`, and `palette.test.ts`
 * holds them to it.
 */
export const PAPER = "#f4f1e9";
export const INK = "#1c1cc9";

/**
 * The colour of the sweep front while a country unlocks. Dark-on-light is the
 * only contrast direction paper has, so the front reads by getting darker than
 * the sketch rather than brighter. #20 replaces this with a dye derived from
 * each country's tapestry hue; until then it is the ink, deepened.
 */
export const SHIMMER = "#0f0f6f";

/** A six-digit hex as a GLSL `vec3` literal, for pasting into a shader's source. */
export function glslVec3(hex: string): string {
  const channels = [1, 3, 5].map((at) => (parseInt(hex.slice(at, at + 2), 16) / 255).toFixed(4));
  return `vec3(${channels.join(", ")})`;
}
