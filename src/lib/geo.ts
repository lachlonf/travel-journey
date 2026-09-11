import type { LatLng } from "./types";

export type Vec3 = [number, number, number];

/** A camera stop: a point on the globe plus height above the surface, in globe radii. */
export interface CameraStop extends LatLng {
  altitude: number;
}

export const EARTH_RADIUS_KM = 6371;
const RAD = Math.PI / 180;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const normalize = (v: Vec3): Vec3 => scale(v, 1 / Math.hypot(...v));

/**
 * Position on a sphere, laid out to match three.js SphereGeometry's UVs so an
 * equirectangular texture lines up: lng -180 is the texture's left edge.
 */
export function latLngToVector3(lat: number, lng: number, radius = 1): Vec3 {
  const phi = (lng + 180) * RAD;
  const theta = (90 - lat) * RAD;
  return [-radius * Math.cos(phi) * Math.sin(theta), radius * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta)];
}

export function vector3ToLatLng([x, y, z]: readonly [number, number, number]): LatLng {
  const r = Math.hypot(x, y, z);
  const lat = 90 - Math.acos(clamp(y / r, -1, 1)) / RAD;
  let lng = Math.atan2(z, -x) / RAD - 180;
  if (lng < -180) lng += 360;
  return { lat, lng };
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearestCity<T extends LatLng>(point: LatLng, cities: readonly T[]): T | null {
  let best: T | null = null;
  let bestKm = Infinity;
  for (const city of cities) {
    const km = distanceKm(point, city);
    if (km < bestKm) [best, bestKm] = [city, km];
  }
  return best;
}

/** Mean position on the sphere (not of raw lat/lng, which breaks across the antimeridian). */
export function centroid(points: readonly LatLng[]): LatLng {
  const sum = points.reduce<Vec3>((acc, p) => add(acc, latLngToVector3(p.lat, p.lng)), [0, 0, 0]);
  if (Math.hypot(...sum) < 1e-9) return points[0] ?? { lat: 0, lng: 0 };
  return vector3ToLatLng(sum);
}

/** Furthest distance from `center` to any point. */
export function spreadKm(center: LatLng, points: readonly LatLng[]): number {
  return points.reduce((max, p) => Math.max(max, distanceKm(center, p)), 0);
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Camera position `t` of the way along a flight: slerps along the great circle,
 * interpolates altitude, and lifts off mid-flight in proportion to the hop's length.
 */
export function flightPosition(from: CameraStop, to: CameraStop, t: number): Vec3 {
  const e = easeInOutCubic(clamp(t, 0, 1));
  const a = latLngToVector3(from.lat, from.lng);
  const b = latLngToVector3(to.lat, to.lng);
  const angle = Math.acos(clamp(dot(a, b), -1, 1));
  const sin = Math.sin(angle);

  let direction: Vec3;
  if (angle < 1e-9) {
    direction = a;
  } else if (sin < 1e-6) {
    // Antipodal: any great circle works, so pick one through a stable axis.
    const axis = normalize(cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    direction = add(scale(a, Math.cos(e * Math.PI)), scale(cross(axis, a), Math.sin(e * Math.PI)));
  } else {
    direction = add(scale(a, Math.sin((1 - e) * angle) / sin), scale(b, Math.sin(e * angle) / sin));
  }

  // Interpolate altitude geometrically: each moment of the dive covers the same zoom factor.
  const [low, high] = [Math.max(from.altitude, 1e-4), Math.max(to.altitude, 1e-4)];
  const cruise = low * (high / low) ** e;
  const lift = 1.5 * Math.sin(angle / 2) * Math.sin(Math.PI * e);
  const altitude = cruise + lift;
  return scale(direction, 1 + altitude);
}
