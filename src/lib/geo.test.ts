import { describe, expect, it } from "vitest";
import { centroid, distanceKm, flightPosition, latLngToVector3, nearestCity, vector3ToLatLng } from "./geo";

type Vec = readonly [number, number, number];

const expectVec = (actual: Vec, expected: Vec, digits = 6) =>
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], digits));
const length = ([x, y, z]: Vec) => Math.hypot(x, y, z);
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const huaraz = { name: "Huaraz", lat: -9.52614, lng: -77.52869, countryCode: "PE" };
const carhuaz = { name: "Carhuaz", lat: -9.28194, lng: -77.64472, countryCode: "PE" };
const cusco = { name: "Cusco", lat: -13.53195, lng: -71.96746, countryCode: "PE" };
const laguna513 = { lat: -9.2112, lng: -77.5466 };

describe("latLngToVector3", () => {
  it("matches three.js SphereGeometry's equirectangular UV layout", () => {
    expectVec(latLngToVector3(0, 0), [1, 0, 0]);
    expectVec(latLngToVector3(0, 90), [0, 0, -1]);
    expectVec(latLngToVector3(0, -90), [0, 0, 1]);
    expectVec(latLngToVector3(90, 0), [0, 1, 0]);
  });

  it("scales by radius and round-trips through vector3ToLatLng", () => {
    expectVec(latLngToVector3(0, 0, 2), [2, 0, 0]);
    const { lat, lng } = vector3ToLatLng(latLngToVector3(-13.53, -71.97, 3));
    expect(lat).toBeCloseTo(-13.53, 6);
    expect(lng).toBeCloseTo(-71.97, 6);
  });
});

describe("distanceKm", () => {
  it("measures great-circle distance", () => {
    expect(distanceKm(huaraz, huaraz)).toBe(0);
    const londonToParis = distanceKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 });
    expect(Math.abs(londonToParis - 344)).toBeLessThan(3);
  });
});

describe("nearestCity", () => {
  it("picks the closest city by great-circle distance", () => {
    expect(nearestCity(laguna513, [huaraz, carhuaz, cusco])).toBe(carhuaz);
  });

  it("returns null with no candidates", () => {
    expect(nearestCity(laguna513, [])).toBeNull();
  });
});

describe("centroid", () => {
  it("averages on the sphere, so points either side of the antimeridian meet at 180°", () => {
    const { lat, lng } = centroid([
      { lat: 0, lng: 170 },
      { lat: 0, lng: -170 },
    ]);
    expect(lat).toBeCloseTo(0, 6);
    expect(Math.abs(lng)).toBeCloseTo(180, 6);
  });
});

describe("flightPosition", () => {
  const lima = { lat: -12.0464, lng: -77.0428, altitude: 0.3 };
  const tokyo = { lat: 35.6762, lng: 139.6503, altitude: 0.1 };

  it("starts and ends exactly at the endpoints, clamping t", () => {
    expectVec(flightPosition(lima, tokyo, 0), latLngToVector3(lima.lat, lima.lng, 1.3));
    expectVec(flightPosition(lima, tokyo, 1), latLngToVector3(tokyo.lat, tokyo.lng, 1.1));
    expectVec(flightPosition(lima, tokyo, -1), flightPosition(lima, tokyo, 0));
    expectVec(flightPosition(lima, tokyo, 2), flightPosition(lima, tokyo, 1));
  });

  it("lifts above both endpoints mid-flight on long hops", () => {
    expect(length(flightPosition(lima, tokyo, 0.5)) - 1).toBeGreaterThan(0.3);
  });

  it("follows the great circle between the endpoints", () => {
    const normal = cross(latLngToVector3(lima.lat, lima.lng), latLngToVector3(tokyo.lat, tokyo.lng));
    for (const t of [0.25, 0.5, 0.75]) {
      const p = flightPosition(lima, tokyo, t);
      expect(dot(p, normal) / length(p) / length(normal)).toBeCloseTo(0, 6);
    }
  });

  it("zooms geometrically, so a dive from space doesn't rush the last stretch", () => {
    const high = { lat: 0, lng: 0, altitude: 2 };
    const low = { lat: 0, lng: 0, altitude: 0.02 };
    expect(length(flightPosition(high, low, 0.5)) - 1).toBeCloseTo(0.2, 6);
  });

  it("barely lifts on short hops", () => {
    const from = { ...huaraz, altitude: 0.02 };
    const to = { ...laguna513, altitude: 0.02 };
    expect(length(flightPosition(from, to, 0.5)) - 1).toBeLessThan(0.05);
  });
});
