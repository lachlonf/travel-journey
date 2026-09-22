import { glslVec3, INK, PAPER } from "./ink";

export const globeVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Pass 1: everything the glyph pass needs about this pixel, one value per channel.
 * The lit earth is reduced to ink density here rather than carried as a colour, so
 * that the country and its light can travel alongside it and the only colour the
 * globe ever wears is the tapestry hue the glyph pass looks up.
 * unlockTex holds, per country: r = progress, g = west edge, b = width (texture fractions).
 */
export const globeFragment = /* glsl */ `
uniform sampler2D earthMap;
uniform sampler2D countryMask;
uniform sampler2D unlockTex;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float country = floor(texture2D(countryMask, vUv).r * 255.0 + 0.5);
  vec4 info = country > 0.0 ? texture2D(unlockTex, vec2((country + 0.5) / 256.0, 0.5)) : vec4(0.0);
  // Sweep west to east: the west edge starts at once, the east edge finishes last.
  // The ASCII pass then breaks the front up glyph by glyph.
  float across = clamp((vUv.x - info.g) / max(info.b, 1.0 / 255.0), 0.0, 1.0);
  float unlock = clamp(info.r * 1.6 - across * 0.6, 0.0, 1.0);

  float facing = clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
  float land = step(0.5, country);
  // Brighter land and dimmer sea, so continents come through as denser glyphs
  // and unlocked countries don't look murky. Land also gets a flat lift on top
  // of the scaling: forest is nearly as dark as water in the texture, and close
  // in, where nothing is foreshortened, that leaves a coastline with no edge.
  vec3 surface = texture2D(earthMap, vUv).rgb * (0.3 + 0.8 * facing) * mix(0.65, 1.45, land) + land * 0.1;
  // The glyph pass reads this image's brightness as ink density, so the limb is
  // pushed into the brightness here: without it the sketch has no edge against
  // the paper, and the globe reads as a pale ring rather than a world.
  float limb = pow(1.0 - facing, 3.0) * 0.55;

  // r: ink density, which is all the sketch ever needed the earth for.
  // g: which country, so the glyph pass can find the hue it blooms into.
  // b: how lit this pixel is, kept clear of the terrain so a bloomed hue stays
  //    flat and woven while still curving away like a sphere.
  // a: how far the sweep has passed this pixel.
  gl_FragColor = vec4(
    dot(surface, vec3(0.299, 0.587, 0.114)) + limb,
    country / 255.0,
    0.55 + 0.45 * facing,
    unlock
  );
}
`;

export const fullscreenVertex = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Pass 2: every screen cell becomes a glyph picked by brightness, unless its
 * country's unlock has passed the cell's random threshold, in which case the
 * country's tapestry hue blooms through. Cells right at the front flicker in a
 * deepened dye of that same hue, so no second colour ever appears.
 */
export const asciiFragment = /* glsl */ `
uniform sampler2D scene;
uniform sampler2D hues;
uniform sampler2D glyphs;
uniform float glyphCount;
uniform vec2 resolution;
uniform float cellSize;
uniform float time;

varying vec2 vUv;

const vec3 PAPER = ${glslVec3(PAPER)};
const vec3 INK = ${glslVec3(INK)};

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

/** The tapestry hue of the country a pixel of pass 1 belongs to. Black where none has been visited. */
vec3 hueAt(vec4 pixel) {
  return texture2D(hues, vec2((floor(pixel.g * 255.0 + 0.5) + 0.5) / 256.0, 0.5)).rgb;
}

/**
 * The sweep front: the colour steeped darker than it will settle. Dark-on-light
 * is the only contrast paper has, and taking the front from the country's own
 * hue keeps the globe down to one colour at a time. Steeped from the hue as it
 * falls here rather than from the raw hue, so the front reads the same crossing
 * a country at the rim as at the centre, where the two would otherwise close up.
 */
vec3 dye(vec3 settled) {
  return settled * 0.45;
}

float glyph(float index, vec2 local) {
  return texture2D(glyphs, vec2((index + local.x) / glyphCount, local.y)).r;
}

void main() {
  vec2 pixel = vUv * resolution;
  vec2 cell = floor(pixel / cellSize);
  vec2 local = fract(pixel / cellSize);
  vec4 centre = texture2D(scene, (cell + 0.5) * cellSize / resolution);
  vec4 here = texture2D(scene, vUv);
  float threshold = 0.01 + 0.98 * hash(cell);

  // Per pixel, so coastlines cut cleanly through half-bloomed cells.
  if (here.a >= threshold) {
    vec3 settled = hueAt(here) * here.b;
    float edge = 1.0 - smoothstep(0.0, 0.12, here.a - threshold);
    float settling = 1.0 - step(0.999, here.a);
    gl_FragColor = vec4(mix(settled, dye(settled), edge * settling * 0.8), 1.0);
    return;
  }

  // The ramp starts below black so the sea, which is only just above it, still
  // gets the faintest glyph: on paper an empty cell is nothing at all, and the
  // oceans would read as holes torn in the sketch rather than as water. Off the
  // globe there is no brightness at all, so the paper around it stays bare.
  float level = smoothstep(-0.06, 0.62, centre.r);
  float index = floor(level * (glyphCount - 1.0) + 0.5);
  // Ink only ever darkens paper, so the ramp is a wash of ink over the ground
  // with a floor under it: the faintest glyph is still a mark, where scaling the
  // ink towards the paper would let the ocean disappear.
  vec3 ink = mix(PAPER, INK, 0.18 + 0.82 * level);

  float pending = centre.a > 0.0 ? 1.0 - smoothstep(0.0, 0.1, threshold - centre.a) : 0.0;
  if (pending > 0.0) {
    index = 1.0 + floor(hash(cell + floor(time * 18.0)) * (glyphCount - 1.0));
    ink = mix(ink, dye(hueAt(centre) * centre.b), pending);
  }

  gl_FragColor = vec4(mix(PAPER, ink, glyph(index, local)), 1.0);
}
`;
