/**
 * PROTOTYPE — throwaway, branch `prototype/tapestry-unlock`, issue #18.
 *
 * Question: does a country blooming from ink glyphs into flat tapestry colour
 * actually read well on a light ground? On near-black, dead glyphs against vivid
 * terrain were obvious. On paper the risks are that the hue reads as muddy, or as
 * a sticker pasted on, or that the shimmer on the sweep front vanishes entirely.
 *
 * Three structurally different answers, switchable with `?variant=` on /explore:
 *
 *   A  Dye bath      — glyphs dissolve, flat hue soaks the shape. The literal
 *                      reading of the spec. Shimmer is a deeper dye of the same hue.
 *   B  Woven glyphs  — no flat fill at all. The glyphs themselves take the hue and
 *                      densify, so colour arrives as weave with paper still showing.
 *   C  Letterpress   — flat hue as a printed patch with a hard registration wipe and
 *                      an off-register ink plate; terrain still modulates the hue.
 *
 * Nothing here is written to be kept. The findings are, and they live in
 * PROTOTYPE-FINDINGS.md next to this file.
 */

import * as THREE from "three";
import { tapestryHue } from "@/lib/tapestry";

export const VARIANT_KEYS = ["A", "B", "C", "D"] as const;
export type VariantKey = (typeof VARIANT_KEYS)[number];

export const VARIANT_NAMES: Record<VariantKey, string> = {
  A: "Dye bath",
  B: "Woven glyphs",
  C: "Letterpress",
  D: "Printed bloom",
};

export function asVariant(value: string | null | undefined): VariantKey {
  return (VARIANT_KEYS as readonly string[]).includes(value ?? "") ? (value as VariantKey) : "A";
}

/**
 * Countries the prototype unlocks on top of whatever the seed data holds, so the
 * question can be asked of neighbours, of a tiny country and of a huge one at once.
 * `numericId` is the ISO 3166-1 numeric the country mask is keyed by.
 */
export const DEMO_COUNTRIES = [
  { code: "PE", numericId: "604", center: { lat: -9.19, lng: -75.02 } },
  { code: "BO", numericId: "068", center: { lat: -16.29, lng: -63.59 } },
  { code: "CL", numericId: "152", center: { lat: -35.68, lng: -71.54 } },
  { code: "AR", numericId: "032", center: { lat: -38.42, lng: -63.62 } },
  { code: "BR", numericId: "076", center: { lat: -14.24, lng: -51.93 } },
  { code: "IS", numericId: "352", center: { lat: 64.96, lng: -19.02 } },
  { code: "MA", numericId: "504", center: { lat: 31.79, lng: -7.09 } },
  { code: "JP", numericId: "392", center: { lat: 36.2, lng: 138.25 } },
  { code: "NZ", numericId: "554", center: { lat: -40.9, lng: 174.89 } },
  { code: "US", numericId: "840", center: { lat: 37.09, lng: -95.71 } },
];

/** 256×1 lookup: mask index → that country's tapestry hue, read by the glyph pass. */
export function createHueTexture(): { texture: THREE.DataTexture; data: Uint8Array } {
  const data = new Uint8Array(256 * 4);
  const texture = new THREE.DataTexture(data, 256, 1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return { texture, data };
}

export function writeHue(data: Uint8Array, index: number, countryCode: string): void {
  const hex = tapestryHue(countryCode).slice(1);
  const value = parseInt(hex, 16);
  data[index * 4] = (value >> 16) & 255;
  data[index * 4 + 1] = (value >> 8) & 255;
  data[index * 4 + 2] = value & 255;
  data[index * 4 + 3] = 255;
}

/**
 * PROTOTYPE pass 1. Production packs the lit earth in rgb; here rgb carries what
 * the glyph pass needs to colour a country by itself:
 *   r = terrain brightness (drives glyph density)   g = country index / 255
 *   b = limb (how close to the edge of the globe)   a = unlock progress
 * The render target is sampled with NearestFilter so g stays a real index.
 */
export const prototypeGlobeFragment = /* glsl */ `
uniform sampler2D earthMap;
uniform sampler2D countryMask;
uniform sampler2D unlockTex;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float country = floor(texture2D(countryMask, vUv).r * 255.0 + 0.5);
  vec4 info = country > 0.0 ? texture2D(unlockTex, vec2((country + 0.5) / 256.0, 0.5)) : vec4(0.0);
  float across = clamp((vUv.x - info.g) / max(info.b, 1.0 / 255.0), 0.0, 1.0);
  float unlock = clamp(info.r * 1.6 - across * 0.6, 0.0, 1.0);

  float facing = clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
  float land = step(0.5, country);
  float terrain = dot(texture2D(earthMap, vUv).rgb, vec3(0.299, 0.587, 0.114));
  // Land denser than sea, and the whole thing dimmer towards the limb.
  float level = clamp(terrain * (0.45 + 0.7 * facing) * mix(0.55, 1.5, land), 0.0, 1.0);
  float limb = pow(1.0 - facing, 3.0);

  gl_FragColor = vec4(level, country / 255.0, limb, unlock);
}
`;

const HEAD = /* glsl */ `
uniform sampler2D scene;
uniform sampler2D glyphs;
uniform sampler2D hueTex;
uniform float glyphCount;
uniform vec2 resolution;
uniform float cellSize;
uniform float time;

varying vec2 vUv;

// The paper and the one ink, straight out of globals.css.
const vec3 PAPER = vec3(0.957, 0.945, 0.914);
const vec3 INK = vec3(0.110, 0.110, 0.788);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float glyph(float index, vec2 local) {
  return texture2D(glyphs, vec2((index + local.x) / glyphCount, local.y)).r;
}

vec3 hueOf(vec4 sample_) {
  float index = floor(sample_.g * 255.0 + 0.5);
  return texture2D(hueTex, vec2((index + 0.5) / 256.0, 0.5)).rgb;
}

// An impression on paper: faint marks are the same ink, pressed lighter.
vec3 impression(float weight) {
  return mix(PAPER, INK, clamp(0.18 + 0.82 * weight, 0.0, 1.0));
}

// How dense a glyph this cell wants, with the limb pressed darker so the globe keeps an edge.
float levelOf(vec4 centre) {
  return clamp(smoothstep(0.03, 0.6, centre.r) + centre.b * 0.55, 0.0, 1.0);
}
`;

/**
 * A — Dye bath. The spec taken at its word: glyphs dissolve cell by cell and flat
 * tapestry colour soaks the country. The shimmer on the front, amber on black, is
 * here a deeper dye of the country's own hue — amber on paper would just be dirt.
 */
const VARIANT_A = /* glsl */ `
${HEAD}
void main() {
  vec2 pixel = vUv * resolution;
  vec2 cell = floor(pixel / cellSize);
  vec2 local = fract(pixel / cellSize);
  vec4 centre = texture2D(scene, (cell + 0.5) * cellSize / resolution);
  vec4 here = texture2D(scene, vUv);
  float threshold = 0.01 + 0.98 * hash(cell);

  if (here.a >= threshold) {
    vec3 hue = hueOf(here);
    float edge = 1.0 - smoothstep(0.0, 0.12, here.a - threshold);
    float settling = 1.0 - step(0.999, here.a);
    // Deeper dye where the front is passing, and a darker rim at the limb.
    vec3 deep = mix(hue, INK, 0.5);
    vec3 dyed = mix(hue, deep, edge * settling * 0.9) * (1.0 - here.b * 0.35);
    gl_FragColor = vec4(dyed, 1.0);
    return;
  }

  float level = levelOf(centre);
  float index = floor(level * (glyphCount - 1.0) + 0.5);
  vec3 mark = impression(level);

  float pending = centre.a > 0.0 ? 1.0 - smoothstep(0.0, 0.1, threshold - centre.a) : 0.0;
  if (pending > 0.0) {
    index = 1.0 + floor(hash(cell + floor(time * 18.0)) * (glyphCount - 1.0));
    mark = mix(mark, mix(hueOf(centre), INK, 0.35), pending);
  }

  gl_FragColor = vec4(mix(PAPER, mark, glyph(index, local)), 1.0);
}
`;

/**
 * B — Woven glyphs. No flat fill anywhere: the country stays a field of characters,
 * but the characters take its hue and press denser, so paper keeps showing through
 * the weave. Asks whether the flat fill is the thing carrying the reward at all.
 */
const VARIANT_B = /* glsl */ `
${HEAD}
void main() {
  vec2 pixel = vUv * resolution;
  vec2 cell = floor(pixel / cellSize);
  vec2 local = fract(pixel / cellSize);
  vec4 centre = texture2D(scene, (cell + 0.5) * cellSize / resolution);
  vec4 here = texture2D(scene, vUv);
  float threshold = 0.01 + 0.98 * hash(cell);

  // Per-pixel so coastlines still cut through a half-woven cell.
  float dyed = step(threshold, here.a);
  float front = dyed * (1.0 - smoothstep(0.0, 0.14, here.a - threshold)) * (1.0 - step(0.999, here.a));

  float level = levelOf(centre);
  // The weave tightens as the country unlocks: sparse sketch becomes dense cloth.
  float woven = mix(level, clamp(level * 1.25 + 0.42, 0.0, 1.0), dyed);
  float index = floor(woven * (glyphCount - 1.0) + 0.5);

  vec3 hue = hueOf(here);
  vec3 thread = mix(PAPER, hue, clamp(0.55 + 0.45 * woven, 0.0, 1.0));
  vec3 mark = mix(impression(level), thread, dyed);
  // The front is one pass of the darkest thread, so the sweep is visible without a flash.
  mark = mix(mark, mix(hue, INK, 0.45), front);

  float pending = centre.a > 0.0 ? 1.0 - smoothstep(0.0, 0.1, threshold - centre.a) : 0.0;
  if (pending > 0.0 && dyed < 0.5) {
    index = 1.0 + floor(hash(cell + floor(time * 18.0)) * (glyphCount - 1.0));
    mark = mix(mark, mix(hueOf(centre), INK, 0.3), pending);
  }

  gl_FragColor = vec4(mix(PAPER, mark, glyph(index, local)), 1.0);
}
`;

/**
 * C — Letterpress. The hue arrives as a printed patch: no dissolve, a hard wipe
 * edge, an ink plate laid slightly off register, and terrain left modulating the
 * colour so the patch sits in the paper instead of on it.
 */
const VARIANT_C = /* glsl */ `
${HEAD}
const vec2 REGISTER = vec2(3.0, -2.5);

void main() {
  vec2 pixel = vUv * resolution;
  vec2 cell = floor(pixel / cellSize);
  vec2 local = fract(pixel / cellSize);
  vec4 centre = texture2D(scene, (cell + 0.5) * cellSize / resolution);
  vec4 here = texture2D(scene, vUv);
  // The ink plate is printed a few pixels out, so the colour patch shows a rim.
  vec4 plate = texture2D(scene, vUv + REGISTER / resolution);

  // A hard wipe, not a dissolve: the front is a straight edge crossing the country.
  float wiped = smoothstep(0.46, 0.54, here.a);
  float platePrinted = smoothstep(0.46, 0.54, plate.a);
  float rim = clamp(platePrinted - wiped, 0.0, 1.0);

  float level = levelOf(centre);
  float index = floor(level * (glyphCount - 1.0) + 0.5);
  float mask = glyph(index, local);
  vec3 sketch = mix(PAPER, impression(level), mask);

  vec3 hue = hueOf(here);
  // Terrain stays in the ink of the patch, so relief survives the colour.
  vec3 plate_ = hue * (0.78 + 0.34 * smoothstep(0.0, 0.7, here.r)) * (1.0 - here.b * 0.3);
  // A struck edge where the wipe is passing right now.
  float striking = (1.0 - step(0.999, here.a)) * (1.0 - smoothstep(0.0, 0.08, abs(here.a - 0.5)));
  plate_ = mix(plate_, mix(hue, INK, 0.6), striking);

  vec3 printed = mix(sketch, plate_, wiped);
  printed = mix(printed, mix(PAPER, INK, 0.75), rim * 0.85);

  gl_FragColor = vec4(printed, 1.0);
}
`;

/**
 * D — Printed bloom. What A, B and C each half-answer, put together: the front is
 * B's band of hue-dyed glyphs (so the sweep is made of marks, not confetti), the
 * dissolve is tightened to a ragged line rather than scattered cells, and what it
 * leaves behind is C's plate — hue with terrain still in it and an ink rim — so
 * the colour sits in the paper instead of on it.
 */
const VARIANT_D = /* glsl */ `
${HEAD}
const vec2 REGISTER = vec2(2.5, -2.0);

void main() {
  vec2 pixel = vUv * resolution;
  vec2 cell = floor(pixel / cellSize);
  vec2 local = fract(pixel / cellSize);
  vec4 centre = texture2D(scene, (cell + 0.5) * cellSize / resolution);
  vec4 here = texture2D(scene, vUv);
  vec4 plate = texture2D(scene, vUv + REGISTER / resolution);

  // A tight ragged front: the cell jitter is a third of A's, so it reads as a torn
  // edge travelling across the country rather than as scattered colour.
  float jitter = 0.33 * hash(cell);
  float dyed = step(0.5 + jitter * 0.5, here.a + 0.25);
  float platePrinted = step(0.5 + jitter * 0.5, plate.a + 0.25);
  float rim = clamp(platePrinted - dyed, 0.0, 1.0);

  float level = levelOf(centre);
  vec3 hue = hueOf(here);

  // Behind the front: the plate. Terrain still modulates the hue, and the limb darkens it.
  vec3 printed = hue * (0.8 + 0.3 * smoothstep(0.0, 0.7, here.r)) * (1.0 - here.b * 0.3);

  // The front itself, one cell deep: dense glyphs in the darkest dye of the hue.
  float front = dyed * (1.0 - smoothstep(0.0, 0.1, here.a - (0.5 + jitter * 0.5 - 0.25))) * (1.0 - step(0.999, here.a));
  float frontIndex = floor(mix(level, 1.0, 0.7) * (glyphCount - 1.0) + 0.5);
  printed = mix(printed, mix(mix(hue, INK, 0.5), PAPER, 1.0 - glyph(frontIndex, local)), front);

  // Ahead of the front: the resting sketch, its glyphs picking up the hue as it approaches.
  float index = floor(level * (glyphCount - 1.0) + 0.5);
  float coming = centre.a > 0.0 ? smoothstep(0.0, 0.35, centre.a) * (1.0 - dyed) : 0.0;
  vec3 mark = mix(impression(level), mix(hue, INK, 0.4), coming);
  vec3 sketch = mix(PAPER, mark, glyph(index, local));

  vec3 colour = mix(sketch, printed, dyed);
  colour = mix(colour, mix(PAPER, INK, 0.7), rim * 0.8);
  gl_FragColor = vec4(colour, 1.0);
}
`;

export const VARIANT_FRAGMENTS: Record<VariantKey, string> = {
  A: VARIANT_A,
  B: VARIANT_B,
  C: VARIANT_C,
  D: VARIANT_D,
};
