/** A colour as a six-digit hex, the form the stylesheet writes them in. */
export type Hex = `#${string}`;

/**
 * The paper the whole site rests on and the one ink it is drawn in, written
 * here once. The glyph pass draws an opaque image over the whole canvas, so the
 * globe's paper has to be the same paper the page rests on; rather than hold two
 * copies to each other, the stylesheet is handed these by the root element (see
 * `inkTokens`) and mixes every fainter impression out of them.
 */
export const PAPER: Hex = "#f4f1e9";
export const INK: Hex = "#1c1cc9";

/**
 * The paper and ink as the custom properties `globals.css` expects to find on
 * the root element. They are the only two colours the stylesheet does not
 * define itself, because the globe needs the same two compiled into a shader.
 */
export function inkTokens(): Record<string, string> {
  return { "--paper": PAPER, "--ink": INK };
}

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
