/** A colour as a six-digit hex, the form the stylesheet writes them in. */
export type Hex = `#${string}`;

/**
 * The paper the globe is drawn on and the ink it is drawn in. The glyph pass
 * writes an opaque image over the whole canvas, so its paper has to be the same
 * paper the page rests on: these are the stylesheet's `--paper` and `--ink`, and
 * `ink.test.ts` holds them to it.
 */
export const PAPER: Hex = "#f4f1e9";
export const INK: Hex = "#1c1cc9";

/** The red, green and blue of a hex, each from 0 to 1. */
export function channels(hex: Hex): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  return [r, g, b];
}

/** A colour as a GLSL `vec3` literal, for pasting into a shader's source. */
export function glslVec3(hex: Hex): string {
  return `vec3(${channels(hex)
    .map((channel) => channel.toFixed(4))
    .join(", ")})`;
}
