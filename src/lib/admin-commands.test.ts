import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAdminCommands, type CommandResult, type PhotoInput, type PlaceInput, type TripInput } from "./admin-commands";
import { buildJourney, tripStops } from "./journey";
import { createLocalRepository } from "./repository/local";

let dir: string;
const repository = () =>
  createLocalRepository({
    dataFile: join(dir, "data", "journey.json"),
    seedFile: join(dir, "seed.json"),
    uploadsDir: join(dir, "uploads"),
    publicUrlPrefix: "/uploads",
  });
const commands = () => createAdminCommands(repository());
const journey = async () => buildJourney(await repository().load());

const city = (input: Partial<PlaceInput> = {}): PlaceInput => ({
  kind: "city",
  name: "Huaraz",
  lat: -9.52614,
  lng: -77.52869,
  countryCode: "PE",
  tripId: null,
  visitedOn: "2025-06-05",
  story: "",
  parent: null,
  ...input,
});

const jpeg = { bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" };

/** For setup steps, which must succeed. */
function unwrap<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "commands-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("addPlace", () => {
  it("adds a spot under a new parent city that joins no trip and records no visit", async () => {
    const trip = unwrap(await commands().createTrip({ name: "South America 2025", story: "", startDate: "2025-06-01", endDate: "2025-07-10" }));
    const result = await commands().addPlace(
      city({
        kind: "poi",
        name: "Laguna 513",
        lat: -9.2112,
        lng: -77.5466,
        tripId: trip.id,
        visitedOn: "2025-06-07",
        parent: { name: "Huaraz", lat: -9.52614, lng: -77.52869 },
      }),
    );

    expect(result.ok).toBe(true);
    const peru = (await journey()).countryByCode.get("PE")!;
    expect(peru.cities.map((c) => [c.place.name, c.pois.map((p) => p.name)])).toEqual([["Huaraz", ["Laguna 513"]]]);
    expect(peru.cities[0].place.visitedOn).toEqual([]);
    expect(tripStops(await journey(), trip.id).map((p) => p.name)).toEqual(["Laguna 513"]);
  });

  it("refuses a city that's already on the map, pointing at the existing city", async () => {
    const huaraz = unwrap(await commands().addPlace(city()));

    const result = await commands().addPlace(city({ name: "huaraz", visitedOn: "2026-01-01" }));

    expect(result).toEqual({
      ok: false,
      error: { code: "city-already-exists", message: "huaraz is already on the map. Add photos to it below instead.", cityId: huaraz.id },
    });
    const peru = (await journey()).countryByCode.get("PE")!;
    expect(peru.cities.map((c) => [c.place.name, c.place.visitedOn])).toEqual([["Huaraz", ["2025-06-05"]]]);
  });
});

describe("validation", () => {
  const photo = async (input: Partial<PhotoInput>) => {
    const place = unwrap(await commands().addPlace(city()));
    return commands().addPhoto({ placeId: place.id, caption: "", takenAt: null, lat: null, lng: null, file: jpeg, ...input });
  };
  const trip = (input: Partial<TripInput>) => commands().createTrip({ name: "Japan", story: "", startDate: null, endDate: null, ...input });

  it.each([
    ["a trip without a name", () => trip({ name: "  " }), "name-required"],
    ["a trip with a malformed date", () => trip({ startDate: "June 2026" }), "invalid-date"],
    ["a trip that ends before it starts", () => trip({ startDate: "2026-06-10", endDate: "2026-06-01" }), "invalid-date"],
    ["a place sent as nothing at all", () => commands().addPlace(null as never), "invalid-kind"],
    ["a place that's neither city nor spot", () => commands().addPlace(city({ kind: "country" as never })), "invalid-kind"],
    ["a place without a name", () => commands().addPlace(city({ name: "" })), "name-required"],
    ["a place off the Earth", () => commands().addPlace(city({ lat: 91 })), "invalid-coordinates"],
    ["a place with a country name for a code", () => commands().addPlace(city({ countryCode: "Peru" })), "invalid-country"],
    ["a place with a malformed visit date", () => commands().addPlace(city({ visitedOn: "5 June" })), "invalid-date"],
    ["a place on a trip that doesn't exist", () => commands().addPlace(city({ tripId: "nope" })), "unknown-trip"],
    ["a spot without a city", () => commands().addPlace(city({ kind: "poi", parent: null })), "parent-city-required"],
    ["a photo that's an SVG", () => photo({ file: { bytes: new Uint8Array([1]), contentType: "image/svg+xml" } }), "unsupported-file-type"],
    ["a photo without a file", () => photo({ file: null }), "unsupported-file-type"],
    ["a photo with a malformed date", () => photo({ takenAt: "yesterday" }), "invalid-date"],
    ["a photo for a place that doesn't exist", () => photo({ placeId: "nope" }), "unknown-place"],
  ] as const)("refuses %s", async (_, run, code) => {
    const result = await run();
    expect(result.ok ? null : result.error.code).toBe(code);
  });

  it("writes nothing when it refuses", async () => {
    await commands().addPlace(city({ lat: 91 }));
    await trip({ name: "" });

    const after = await journey();
    expect(after.countries).toEqual([]);
    expect(after.tripById.size).toBe(0);
  });
});

describe("addPhoto", () => {
  it("adds photos to a place in upload order", async () => {
    const place = unwrap(await commands().addPlace(city()));

    const first = await commands().addPhoto({ placeId: place.id, caption: "the lake", takenAt: "2025-06-07", lat: -9.2, lng: -77.5, file: jpeg });
    const second = await commands().addPhoto({ placeId: place.id, caption: "the climb", takenAt: null, lat: null, lng: null, file: jpeg });

    expect(first.ok && second.ok).toBe(true);
    const photos = (await journey()).photosByPlace.get(place.id)!;
    expect(photos.map((p) => [p.caption, p.takenAt, p.lat, p.lng])).toEqual([
      ["the lake", "2025-06-07", -9.2, -77.5],
      ["the climb", null, null, null],
    ]);
  });
});
