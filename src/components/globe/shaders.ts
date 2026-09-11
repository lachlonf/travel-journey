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

/** Pass 1: the lit earth in rgb, and this pixel's country unlock progress in alpha. */
export const globeFragment = /* glsl */ `
uniform sampler2D earthMap;
uniform sampler2D countryMask;
uniform sampler2D unlockTex;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float country = floor(texture2D(countryMask, vUv).r * 255.0 + 0.5);
  float unlock = country > 0.0 ? texture2D(unlockTex, vec2((country + 0.5) / 256.0, 0.5)).r : 0.0;

  float facing = clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
  // Brighter land and dimmer sea, so continents come through as denser glyphs
  // and unlocked countries don't look murky.
  float land = step(0.5, country);
  vec3 surface = texture2D(earthMap, vUv).rgb * (0.3 + 0.8 * facing) * mix(0.65, 1.45, land);
  // A thin haze at the limb outlines the globe, in glyphs and in colour alike.
  vec3 haze = vec3(0.45, 0.62, 0.85) * pow(1.0 - facing, 3.0) * 0.5;

  gl_FragColor = vec4(surface + haze, unlock);
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
 * real surface shows through. Cells right at the threshold flicker and shimmer.
 */
export const asciiFragment = /* glsl */ `
uniform sampler2D scene;
uniform sampler2D glyphs;
uniform float glyphCount;
uniform vec2 resolution;
uniform float cellSize;
uniform float time;

varying vec2 vUv;

const vec3 PAPER = vec3(0.035, 0.043, 0.039);
const vec3 INK = vec3(0.72, 0.86, 0.74);
const vec3 SHIMMER = vec3(1.0, 0.78, 0.42);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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

  // Per pixel, so coastlines cut cleanly through half-revealed cells.
  if (here.a >= threshold) {
    float edge = 1.0 - smoothstep(0.0, 0.12, here.a - threshold);
    float settling = 1.0 - step(0.999, here.a);
    gl_FragColor = vec4(mix(here.rgb, SHIMMER, edge * settling * 0.8), 1.0);
    return;
  }

  float level = smoothstep(0.04, 0.55, dot(centre.rgb, vec3(0.299, 0.587, 0.114)));
  float index = floor(level * (glyphCount - 1.0) + 0.5);
  vec3 ink = INK * (0.35 + 0.65 * level);

  float pending = centre.a > 0.0 ? 1.0 - smoothstep(0.0, 0.1, threshold - centre.a) : 0.0;
  if (pending > 0.0) {
    index = 1.0 + floor(hash(cell + floor(time * 18.0)) * (glyphCount - 1.0));
    ink = mix(ink, SHIMMER, pending);
  }

  gl_FragColor = vec4(mix(PAPER, ink, glyph(index, local)), 1.0);
}
`;
