import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAdminCommands, type CommandResult, type PhotoInput, type PlaceInput, type PlaceUpdate, type TripInput } from "./admin-commands";
import { buildJourney, tripStops } from "./journey";
import { createLocalRepository } from "./repository/local";
import type { Place } from "./types";

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

  it("turns the place's story text into a single text block", async () => {
    const huaraz = unwrap(await commands().addPlace(city({ story: "Arrived in the rain.\n\nThe lake was worth it." })));

    expect((await journey()).storyByPlace.get(huaraz.id)).toEqual([{ type: "text", text: "Arrived in the rain.\n\nThe lake was worth it." }]);
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

describe("updatePlace", () => {
  it("renames and moves a place", async () => {
    const trip = unwrap(await commands().createTrip({ name: "South America 2025", story: "", startDate: null, endDate: null }));
    const place = unwrap(await commands().addPlace(city({ name: "Huaras", tripId: trip.id })));

    const result = await commands().updatePlace({
      id: place.id,
      name: "Huaraz",
      lat: -9.5,
      lng: -77.5,
      countryCode: "pe",
      tripId: null,
      parent: null,
    });

    expect(result.ok).toBe(true);
    const after = await journey();
    expect(after.countryByCode.get("PE")!.cities.map((c) => [c.place.name, c.place.lat, c.place.lng, c.place.tripId])).toEqual([
      ["Huaraz", -9.5, -77.5, null],
    ]);
    expect(tripStops(after, trip.id)).toEqual([]);
  });

  const carhuaz = { name: "Carhuaz", lat: -9.28194, lng: -77.64472 };
  const laguna513 = () => city({ kind: "poi", name: "Laguna 513", lat: -9.2112, lng: -77.5466, parent: carhuaz });
  const spotUpdate = (spot: Place, input: Partial<PlaceUpdate>): PlaceUpdate => ({
    id: spot.id,
    name: spot.name,
    lat: spot.lat,
    lng: spot.lng,
    countryCode: spot.countryCode,
    tripId: spot.tripId,
    parent: carhuaz,
    ...input,
  });

  it("regroups a spot under a different city that's already on the map", async () => {
    unwrap(await commands().addPlace(city()));
    const spot = unwrap(await commands().addPlace(laguna513()));

    const result = await commands().updatePlace(spotUpdate(spot, { parent: { name: "huaraz", lat: 0, lng: 0 } }));

    expect(result.ok).toBe(true);
    const peru = (await journey()).countryByCode.get("PE")!;
    expect(peru.cities.map((c) => [c.place.name, c.pois.map((p) => p.name)])).toEqual([
      ["Huaraz", ["Laguna 513"]],
      ["Carhuaz", []],
    ]);
  });

  it("regroups a spot under a new city name, creating a city that joins no trip and records no visit", async () => {
    const trip = unwrap(await commands().createTrip({ name: "South America 2025", story: "", startDate: null, endDate: null }));
    const spot = unwrap(await commands().addPlace(laguna513()));

    const result = await commands().updatePlace(spotUpdate(spot, { tripId: trip.id, parent: { name: "Yungay", lat: -9.13895, lng: -77.74434 } }));

    expect(result.ok).toBe(true);
    const after = await journey();
    const yungay = after.cityOf.get(spot.id)!.place;
    expect([yungay.name, yungay.countryCode, yungay.tripId, yungay.visitedOn]).toEqual(["Yungay", "PE", null, []]);
    expect(after.countryByCode.get("PE")!.cities.map((c) => [c.place.name, c.pois.map((p) => p.name)])).toEqual([
      ["Carhuaz", []],
      ["Yungay", ["Laguna 513"]],
    ]);
    expect(tripStops(after, trip.id).map((p) => p.name)).toEqual(["Laguna 513"]);
  });

  it("keeps a spot in the city it already folds into when only its country code is corrected", async () => {
    const spot = unwrap(await commands().addPlace(laguna513()));

    const result = await commands().updatePlace(spotUpdate(spot, { countryCode: "BO" }));

    expect(result.ok).toBe(true);
    const after = await journey();
    expect(after.data.places.filter((p) => p.name === "Carhuaz")).toHaveLength(1);
    expect(after.cityOf.get(spot.id)!.place.name).toBe("Carhuaz");
  });

  it("keeps a city's own name without calling it a duplicate", async () => {
    const huaraz = unwrap(await commands().addPlace(city()));

    const result = await commands().updatePlace({ ...huaraz, name: "HUARAZ", parent: null });

    expect(result.ok).toBe(true);
    expect((await journey()).placeById.get(huaraz.id)!.name).toBe("HUARAZ");
  });

  it("changes nothing when it refuses, not even creating the new city", async () => {
    const spot = unwrap(await commands().addPlace(laguna513()));

    const result = await commands().updatePlace(spotUpdate(spot, { name: "Laguna 69", lat: 91, parent: { name: "Yungay", lat: -9.13895, lng: -77.74434 } }));

    expect(result.ok).toBe(false);
    const peru = (await journey()).countryByCode.get("PE")!;
    expect(peru.cities.map((c) => [c.place.name, c.pois.map((p) => [p.name, p.lat])])).toEqual([["Carhuaz", [["Laguna 513", -9.2112]]]]);
  });
});

describe("validation", () => {
  const photo = async (input: Partial<PhotoInput>) => {
    const place = unwrap(await commands().addPlace(city()));
    return commands().addPhoto({ placeId: place.id, caption: "", takenAt: null, lat: null, lng: null, file: jpeg, ...input });
  };
  const trip = (input: Partial<TripInput>) => commands().createTrip({ name: "Japan", story: "", startDate: null, endDate: null, ...input });
  const update = async (input: Partial<PlaceUpdate>, place: Partial<PlaceInput> = {}) => {
    const added = unwrap(await commands().addPlace(city(place)));
    return commands().updatePlace({ id: added.id, name: added.name, lat: added.lat, lng: added.lng, countryCode: "PE", tripId: null, parent: null, ...input });
  };

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
    ["an update sent as nothing at all", () => commands().updatePlace(null as never), "unknown-place"],
    ["an update to a place that doesn't exist", () => update({ id: "nope" }), "unknown-place"],
    ["renaming a place to nothing", () => update({ name: "  " }), "name-required"],
    ["moving a place off the Earth", () => update({ lng: 181 }), "invalid-coordinates"],
    ["an update with a country name for a code", () => update({ countryCode: "Peru" }), "invalid-country"],
    ["moving a place onto a trip that doesn't exist", () => update({ tripId: "nope" }), "unknown-trip"],
    [
      "taking a spot out of every city",
      () => update({ parent: { name: "", lat: 0, lng: 0 } }, { kind: "poi", parent: { name: "Huaraz", lat: -9.52614, lng: -77.52869 } }),
      "parent-city-required",
    ],
    [
      "renaming a city to one already on the map",
      async () => {
        unwrap(await commands().addPlace(city({ name: "Cusco" })));
        return update({ name: "cusco" });
      },
      "city-already-exists",
    ],
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
  it("adds photos to the end of the place's story, in upload order", async () => {
    const place = unwrap(await commands().addPlace(city({ story: "We made it to the lake." })));

    const first = await commands().addPhoto({ placeId: place.id, caption: "the lake", takenAt: "2025-06-07", lat: -9.2, lng: -77.5, file: jpeg });
    const second = await commands().addPhoto({ placeId: place.id, caption: "the climb", takenAt: null, lat: null, lng: null, file: jpeg });

    expect(first.ok && second.ok).toBe(true);
    const story = (await journey()).storyByPlace.get(place.id)!;
    expect(story.map((block) => (block.type === "text" ? block.text : [block.photo.caption, block.photo.takenAt, block.photo.lat, block.photo.lng]))).toEqual([
      "We made it to the lake.",
      ["the lake", "2025-06-07", -9.2, -77.5],
      ["the climb", null, null, null],
    ]);
  });
});
