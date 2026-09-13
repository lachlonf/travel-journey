import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAdminCommands,
  type CommandResult,
  type PlaceInput,
  type PlaceUpdate,
  type TripInput,
  type TripUpdate,
  type UploadConfirmation,
  type VisitInput,
} from "./admin-commands";
import { buildJourney, tripStops } from "./journey";
import { createLocalRepository, receiveLocalUpload, type LocalRepositoryOptions } from "./repository/local";
import { UPLOAD_TARGET_TTL_MS } from "./repository/types";
import type { Photo, Place } from "./types";

let dir: string;
const options = (overrides: Partial<LocalRepositoryOptions> = {}): LocalRepositoryOptions => ({
  dataFile: join(dir, "data", "journey.json"),
  seedFile: join(dir, "seed.json"),
  uploadsDir: join(dir, "uploads"),
  publicUrlPrefix: "/uploads",
  ...overrides,
});
const repository = (overrides?: Partial<LocalRepositoryOptions>) => createLocalRepository(options(overrides));
const commands = (overrides?: Partial<LocalRepositoryOptions>) => createAdminCommands(repository(overrides));
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

/** A photo on a place, put there the way the browser puts one there: prepare, send the bytes, confirm. */
async function uploadPhoto(placeId: string, input: Partial<UploadConfirmation> = {}): Promise<CommandResult<Photo>> {
  const target = await commands().prepareUpload({ placeId, contentType: "image/jpeg" });
  if (!target.ok) return target;
  await receiveLocalUpload(options(), target.value.uploadId, jpeg);
  return commands().confirmUpload({ uploadId: target.value.uploadId, caption: "", takenAt: null, lat: null, lng: null, ...input });
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
      error: { code: "city-already-exists", message: "huaraz is already on the map. Record a return visit to it instead.", cityId: huaraz.id },
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

describe("visits", () => {
  const peru = async () => (await journey()).countryByCode.get("PE")!;

  it("records a return visit, keeping the dates in order and widening the country's date range", async () => {
    const huaraz = unwrap(await commands().addPlace(city({ visitedOn: "2025-06-05" })));

    const result = await commands().addVisit({ placeId: huaraz.id, date: "2023-01-02" });

    expect(result.ok).toBe(true);
    // The earlier visit sorts first, however late it was entered.
    expect((await journey()).placeById.get(huaraz.id)!.visitedOn).toEqual(["2023-01-02", "2025-06-05"]);
    expect((await peru()).dateRange).toEqual({ from: "2023-01-02", to: "2025-06-05" });
  });

  it("takes the owner from the city that already exists to a visit on it", async () => {
    const huaraz = unwrap(await commands().addPlace(city({ visitedOn: "2025-06-05" })));

    const refused = await commands().addPlace(city({ name: "huaraz", visitedOn: "2026-01-04" }));
    if (refused.ok || refused.error.code !== "city-already-exists") throw new Error("Adding Huaraz twice should have been refused.");
    const result = await commands().addVisit({ placeId: refused.error.cityId, date: "2026-01-04" });

    expect(refused.error.cityId).toBe(huaraz.id);
    expect(result.ok).toBe(true);
    // One Huaraz still, with both dates: the return visit joined the city already on the map.
    expect((await peru()).cities.map((c) => [c.place.name, c.place.visitedOn])).toEqual([["Huaraz", ["2025-06-05", "2026-01-04"]]]);
    expect((await peru()).dateRange).toEqual({ from: "2025-06-05", to: "2026-01-04" });
  });

  it("doesn't record the same day twice", async () => {
    const huaraz = unwrap(await commands().addPlace(city({ visitedOn: "2025-06-05" })));

    const result = await commands().addVisit({ placeId: huaraz.id, date: "2025-06-05" });

    expect(result.ok).toBe(true);
    expect((await journey()).placeById.get(huaraz.id)!.visitedOn).toEqual(["2025-06-05"]);
  });

  it("removes only the visit named, narrowing the country's date range back", async () => {
    const huaraz = unwrap(await commands().addPlace(city({ visitedOn: "2025-06-05" })));
    unwrap(await commands().addVisit({ placeId: huaraz.id, date: "2026-01-04" }));

    const result = await commands().removeVisit({ placeId: huaraz.id, date: "2026-01-04" });

    expect(result.ok).toBe(true);
    expect((await journey()).placeById.get(huaraz.id)!.visitedOn).toEqual(["2025-06-05"]);
    expect((await peru()).dateRange).toEqual({ from: "2025-06-05", to: "2025-06-05" });
  });

  it("records the first visit to a place added without a date", async () => {
    const huaraz = unwrap(await commands().addPlace(city({ visitedOn: null })));

    const result = await commands().addVisit({ placeId: huaraz.id, date: "2025-06-05" });

    expect(result.ok).toBe(true);
    expect((await journey()).placeById.get(huaraz.id)!.visitedOn).toEqual(["2025-06-05"]);
  });

  const visitTo = async (input: Partial<VisitInput>) => {
    const huaraz = unwrap(await commands().addPlace(city()));
    return { placeId: huaraz.id, date: "2026-01-04", ...input };
  };

  it.each([
    ["a visit on a malformed date", async () => commands().addVisit(await visitTo({ date: "4 January" })), "invalid-date"],
    ["a visit with no date at all", async () => commands().addVisit(await visitTo({ date: "" })), "invalid-date"],
    ["a visit to a place that doesn't exist", () => commands().addVisit({ placeId: "nope", date: "2026-01-04" }), "unknown-place"],
    ["a visit sent as nothing at all", () => commands().addVisit(null as never), "unknown-place"],
    ["removing a visit on a malformed date", async () => commands().removeVisit(await visitTo({ date: "4 January" })), "invalid-date"],
    ["removing a visit from a place that doesn't exist", () => commands().removeVisit({ placeId: "nope", date: "2026-01-04" }), "unknown-place"],
    ["a removal sent as nothing at all", () => commands().removeVisit(null as never), "unknown-place"],
  ] as const)("refuses %s", async (_, run, code) => {
    const result = await run();
    expect(result.ok ? null : result.error.code).toBe(code);
  });

  it("changes nothing when it refuses", async () => {
    const huaraz = unwrap(await commands().addPlace(city({ visitedOn: "2025-06-05" })));

    const result = await commands().addVisit({ placeId: huaraz.id, date: "4 January" });

    expect(result.ok).toBe(false);
    expect((await journey()).placeById.get(huaraz.id)!.visitedOn).toEqual(["2025-06-05"]);
  });

  it("leaves a date that was never recorded alone", async () => {
    const huaraz = unwrap(await commands().addPlace(city({ visitedOn: "2025-06-05" })));

    const result = await commands().removeVisit({ placeId: huaraz.id, date: "2026-01-04" });

    expect(result.ok).toBe(true);
    expect((await journey()).placeById.get(huaraz.id)!.visitedOn).toEqual(["2025-06-05"]);
  });
});

describe("updateTrip", () => {
  const southAmerica = (input: Partial<TripInput> = {}) =>
    commands().createTrip({ name: "South America", story: "How it started.", startDate: "2025-06-01", endDate: "2025-07-10", ...input });

  it("refines a trip's name, dates and story", async () => {
    const trip = unwrap(await southAmerica());

    const result = await commands().updateTrip({
      id: trip.id,
      name: "South America 2025",
      story: "How it really started.\n\nThen the mountains.",
      startDate: "2025-06-02",
      endDate: "2025-07-12",
    });

    expect(result.ok).toBe(true);
    const after = (await journey()).tripById.get(trip.id)!;
    expect(after).toEqual({
      id: trip.id,
      name: "South America 2025",
      story: "How it really started.\n\nThen the mountains.",
      startDate: "2025-06-02",
      endDate: "2025-07-12",
    });
  });

  it("keeps the trip's stops when it's renamed", async () => {
    const trip = unwrap(await southAmerica());
    unwrap(await commands().addPlace(city({ tripId: trip.id })));

    const result = await commands().updateTrip({ id: trip.id, name: "Peru 2025", story: "", startDate: null, endDate: null });

    expect(result.ok).toBe(true);
    expect(tripStops(await journey(), trip.id).map((p) => p.name)).toEqual(["Huaraz"]);
  });

  it("changes nothing when it refuses", async () => {
    const trip = unwrap(await southAmerica());

    const result = await commands().updateTrip({ id: trip.id, name: "South America 2025", story: "", startDate: "2025-07-10", endDate: "2025-06-01" });

    expect(result.ok).toBe(false);
    expect((await journey()).tripById.get(trip.id)).toEqual(trip);
  });
});

describe("deleteTrip", () => {
  it("dissolves the trip, keeping its places on the globe", async () => {
    const trip = unwrap(await commands().createTrip({ name: "South America 2025", story: "", startDate: null, endDate: null }));
    const huaraz = unwrap(await commands().addPlace(city({ tripId: trip.id })));

    const result = await commands().deleteTrip(trip.id);

    expect(result.ok).toBe(true);
    const after = await journey();
    expect(after.tripById.size).toBe(0);
    expect(tripStops(after, trip.id)).toEqual([]);
    expect(after.countryByCode.get("PE")!.cities.map((c) => [c.place.name, c.place.tripId])).toEqual([["Huaraz", null]]);
    expect(after.placeById.get(huaraz.id)!.visitedOn).toEqual(["2025-06-05"]);
  });

  it("leaves every other trip and its stops alone", async () => {
    const dissolved = unwrap(await commands().createTrip({ name: "South America 2025", story: "", startDate: null, endDate: null }));
    const kept = unwrap(await commands().createTrip({ name: "Japan 2026", story: "", startDate: null, endDate: null }));
    unwrap(await commands().addPlace(city({ name: "Kyoto", countryCode: "JP", tripId: kept.id })));

    const result = await commands().deleteTrip(dissolved.id);

    expect(result.ok).toBe(true);
    const after = await journey();
    expect([...after.tripById.values()]).toEqual([kept]);
    expect(tripStops(after, kept.id).map((p) => p.name)).toEqual(["Kyoto"]);
  });
});

describe("validation", () => {
  const trip = (input: Partial<TripInput>) => commands().createTrip({ name: "Japan", story: "", startDate: null, endDate: null, ...input });
  const editTrip = async (input: Partial<TripUpdate>) => {
    const added = unwrap(await trip({}));
    return commands().updateTrip({ id: added.id, name: added.name, story: added.story, startDate: null, endDate: null, ...input });
  };
  const update = async (input: Partial<PlaceUpdate>, place: Partial<PlaceInput> = {}) => {
    const added = unwrap(await commands().addPlace(city(place)));
    return commands().updatePlace({ id: added.id, name: added.name, lat: added.lat, lng: added.lng, countryCode: "PE", tripId: null, parent: null, ...input });
  };

  it.each([
    ["a trip without a name", () => trip({ name: "  " }), "name-required"],
    ["a trip with a malformed date", () => trip({ startDate: "June 2026" }), "invalid-date"],
    ["a trip that ends before it starts", () => trip({ startDate: "2026-06-10", endDate: "2026-06-01" }), "invalid-date"],
    ["a trip edit sent as nothing at all", () => commands().updateTrip(null as never), "unknown-trip"],
    ["an edit to a trip that doesn't exist", () => editTrip({ id: "nope" }), "unknown-trip"],
    ["renaming a trip to nothing", () => editTrip({ name: "  " }), "name-required"],
    ["a trip edit with a malformed date", () => editTrip({ startDate: "next June" }), "invalid-date"],
    ["a trip edit that ends before it starts", () => editTrip({ startDate: "2026-06-10", endDate: "2026-06-01" }), "invalid-date"],
    ["deleting a trip that doesn't exist", () => commands().deleteTrip("nope"), "unknown-trip"],
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

describe("setStoryBlocks", () => {
  /** A place with two photos, so a story can be arranged around them. */
  const withPhotos = async (story = "We set out at dawn.\n\nThe lake was worth it.") => {
    const place = unwrap(await commands().addPlace(city({ story })));
    const lake = unwrap(await uploadPhoto(place.id, { caption: "the lake", takenAt: null, lat: null, lng: null }));
    const climb = unwrap(await uploadPhoto(place.id, { caption: "the climb", takenAt: null, lat: null, lng: null }));
    return { place, lake, climb };
  };
  const resolved = async (placeId: string) =>
    (await journey()).storyByPlace.get(placeId)!.map((block) => (block.type === "text" ? block.text : block.photo.caption));

  it("puts a photo between two text passages", async () => {
    const { place, lake } = await withPhotos();

    const result = await commands().setStoryBlocks({
      placeId: place.id,
      blocks: [{ type: "text", text: "We set out at dawn." }, { type: "photo", photoId: lake.id }, { type: "text", text: "The lake was worth it." }],
    });

    expect(result.ok).toBe(true);
    // The photo no block mentions still can't be lost: it waits at the end.
    expect(await resolved(place.id)).toEqual(["We set out at dawn.", "the lake", "The lake was worth it.", "the climb"]);
  });

  it("drops text passages that are empty once trimmed", async () => {
    const { place, lake } = await withPhotos("");

    const result = await commands().setStoryBlocks({
      placeId: place.id,
      blocks: [{ type: "text", text: "  \n  " }, { type: "photo", photoId: lake.id }, { type: "text", text: "  Worth it.  " }],
    });

    expect(result.ok).toBe(true);
    expect(await resolved(place.id)).toEqual(["the lake", "Worth it.", "the climb"]);
  });

  it("moves a photo to the end when its block is taken out, keeping the photo", async () => {
    const { place, lake, climb } = await withPhotos();

    const result = await commands().setStoryBlocks({
      placeId: place.id,
      blocks: [{ type: "photo", photoId: climb.id }, { type: "text", text: "Then down again." }],
    });

    expect(result.ok).toBe(true);
    expect(await resolved(place.id)).toEqual(["the climb", "Then down again.", "the lake"]);
    expect((await journey()).data.photos.map((p) => p.id)).toEqual([lake.id, climb.id]);
  });

  it("changes nothing when it refuses", async () => {
    const { place, lake } = await withPhotos();
    const before = await resolved(place.id);

    const result = await commands().setStoryBlocks({
      placeId: place.id,
      blocks: [{ type: "photo", photoId: lake.id }, { type: "photo", photoId: lake.id }],
    });

    expect(result.ok).toBe(false);
    expect(await resolved(place.id)).toEqual(before);
  });

  it.each([
    [
      "a photo that belongs to another place",
      async () => {
        const { place } = await withPhotos();
        const elsewhere = unwrap(await commands().addPlace(city({ name: "Cusco" })));
        const theirs = unwrap(await uploadPhoto(elsewhere.id, { caption: "", takenAt: null, lat: null, lng: null }));
        return commands().setStoryBlocks({ placeId: place.id, blocks: [{ type: "photo", photoId: theirs.id }] });
      },
      "photo-not-in-this-place",
    ],
    [
      "a photo that isn't there at all",
      async () => {
        const { place } = await withPhotos();
        return commands().setStoryBlocks({ placeId: place.id, blocks: [{ type: "photo", photoId: "nope" }] });
      },
      "photo-not-in-this-place",
    ],
    [
      "the same photo twice",
      async () => {
        const { place, lake } = await withPhotos();
        return commands().setStoryBlocks({
          placeId: place.id,
          blocks: [{ type: "photo", photoId: lake.id }, { type: "photo", photoId: lake.id }],
        });
      },
      "duplicate-photo",
    ],
    ["a story for a place that doesn't exist", () => commands().setStoryBlocks({ placeId: "nope", blocks: [] }), "unknown-place"],
    ["a story sent as nothing at all", () => commands().setStoryBlocks(null as never), "unknown-place"],
    [
      "blocks that aren't a list",
      async () => {
        const { place } = await withPhotos();
        return commands().setStoryBlocks({ placeId: place.id, blocks: "just words" as never });
      },
      "invalid-story",
    ],
    [
      "a block that is neither text nor photo",
      async () => {
        const { place } = await withPhotos();
        return commands().setStoryBlocks({ placeId: place.id, blocks: [{ type: "map" } as never] });
      },
      "invalid-story",
    ],
  ] as const)("refuses %s", async (_, run, code) => {
    const result = await run();
    expect(result.ok ? null : result.error.code).toBe(code);
  });
});

describe("updatePhotoCaption", () => {
  it("shows the new caption in the story", async () => {
    const place = unwrap(await commands().addPlace(city({ story: "We made it to the lake." })));
    const photo = unwrap(await uploadPhoto(place.id, { caption: "a lake", takenAt: null, lat: null, lng: null }));

    const result = await commands().updatePhotoCaption({ placeId: place.id, photoId: photo.id, caption: "  Laguna 513, at last  " });

    expect(result.ok).toBe(true);
    const story = (await journey()).storyByPlace.get(place.id)!;
    expect(story.map((block) => (block.type === "text" ? block.text : block.photo.caption))).toEqual(["We made it to the lake.", "Laguna 513, at last"]);
  });

  it("leaves the photo where it sits in the story", async () => {
    const place = unwrap(await commands().addPlace(city({ story: "" })));
    const first = unwrap(await uploadPhoto(place.id, { caption: "the climb", takenAt: null, lat: null, lng: null }));
    const second = unwrap(await uploadPhoto(place.id, { caption: "the lake", takenAt: null, lat: null, lng: null }));

    unwrap(await commands().updatePhotoCaption({ placeId: place.id, photoId: first.id, caption: "the long climb" }));

    const story = (await journey()).storyByPlace.get(place.id)!;
    expect(story.map((block) => (block.type === "photo" ? [block.photo.id, block.photo.caption] : block.text))).toEqual([
      [first.id, "the long climb"],
      [second.id, "the lake"],
    ]);
  });

  /** A place with one photo, which is all a refusal needs. */
  const withPhoto = async () => {
    const place = unwrap(await commands().addPlace(city({ story: "We made it to the lake." })));
    const photo = unwrap(await uploadPhoto(place.id, { caption: "a lake", takenAt: null, lat: null, lng: null }));
    return { place, photo };
  };

  it.each([
    [
      "a caption on a photo that belongs to another place",
      async () => {
        const { photo } = await withPhoto();
        const elsewhere = unwrap(await commands().addPlace(city({ name: "Cusco" })));
        return commands().updatePhotoCaption({ placeId: elsewhere.id, photoId: photo.id, caption: "not mine" });
      },
      "photo-not-in-this-place",
    ],
    [
      "a caption on a photo that isn't there at all",
      async () => {
        const { place } = await withPhoto();
        return commands().updatePhotoCaption({ placeId: place.id, photoId: "nope", caption: "nothing" });
      },
      "photo-not-in-this-place",
    ],
    ["a caption for a place that doesn't exist", () => commands().updatePhotoCaption({ placeId: "nope", photoId: "nope", caption: "" }), "unknown-place"],
    ["a caption sent as nothing at all", () => commands().updatePhotoCaption(null as never), "unknown-place"],
  ] as const)("refuses %s", async (_, run, code) => {
    const result = await run();
    expect(result.ok ? null : result.error.code).toBe(code);
  });
});

describe("deletePhoto", () => {
  /** A story of text, photo, text, so deleting the photo has to close the gap it leaves. */
  const withPhotoInTheMiddle = async () => {
    const place = unwrap(await commands().addPlace(city({ story: "We set out at dawn." })));
    const photo = unwrap(await uploadPhoto(place.id, { caption: "the lake", takenAt: null, lat: null, lng: null }));
    unwrap(
      await commands().setStoryBlocks({
        placeId: place.id,
        blocks: [{ type: "text", text: "We set out at dawn." }, { type: "photo", photoId: photo.id }, { type: "text", text: "Then down again." }],
      }),
    );
    return { place, photo };
  };
  const resolved = async (placeId: string) =>
    (await journey()).storyByPlace.get(placeId)!.map((block) => (block.type === "text" ? block.text : block.photo.caption));

  it("takes the photo out of the story, leaving the passages around it", async () => {
    const { place, photo } = await withPhotoInTheMiddle();

    const result = await commands().deletePhoto({ placeId: place.id, photoId: photo.id });

    expect(result.ok).toBe(true);
    expect(await resolved(place.id)).toEqual(["We set out at dawn.", "Then down again."]);
    expect((await journey()).data.photos).toEqual([]);
  });

  it("deletes the stored file, so the photo isn't reachable by URL any more", async () => {
    const { place, photo } = await withPhotoInTheMiddle();
    const file = join(dir, "uploads", basename(photo.url));
    expect(existsSync(file)).toBe(true);

    unwrap(await commands().deletePhoto({ placeId: place.id, photoId: photo.id }));

    expect(existsSync(file)).toBe(false);
  });

  it("leaves the place's other photos in the story", async () => {
    const place = unwrap(await commands().addPlace(city({ story: "" })));
    const lake = unwrap(await uploadPhoto(place.id, { caption: "the lake", takenAt: null, lat: null, lng: null }));
    const climb = unwrap(await uploadPhoto(place.id, { caption: "the climb", takenAt: null, lat: null, lng: null }));

    unwrap(await commands().deletePhoto({ placeId: place.id, photoId: lake.id }));

    expect(await resolved(place.id)).toEqual(["the climb"]);
    expect((await journey()).data.photos.map((p) => p.id)).toEqual([climb.id]);
  });

  it.each([
    [
      "deleting a photo that belongs to another place",
      async () => {
        const { photo } = await withPhotoInTheMiddle();
        const elsewhere = unwrap(await commands().addPlace(city({ name: "Cusco" })));
        return commands().deletePhoto({ placeId: elsewhere.id, photoId: photo.id });
      },
      "photo-not-in-this-place",
    ],
    [
      "deleting a photo that isn't there at all",
      async () => {
        const { place } = await withPhotoInTheMiddle();
        return commands().deletePhoto({ placeId: place.id, photoId: "nope" });
      },
      "photo-not-in-this-place",
    ],
    ["deleting a photo from a place that doesn't exist", () => commands().deletePhoto({ placeId: "nope", photoId: "nope" }), "unknown-place"],
    ["a deletion sent as nothing at all", () => commands().deletePhoto(null as never), "unknown-place"],
  ] as const)("refuses %s", async (_, run, code) => {
    const result = await run();
    expect(result.ok ? null : result.error.code).toBe(code);
  });

  it("changes nothing when it refuses", async () => {
    const { place, photo } = await withPhotoInTheMiddle();
    const before = await resolved(place.id);

    const result = await commands().deletePhoto({ placeId: place.id, photoId: "nope" });

    expect(result.ok).toBe(false);
    expect(await resolved(place.id)).toEqual(before);
    expect(existsSync(join(dir, "uploads", basename(photo.url)))).toBe(true);
  });
});

describe("deletePlace", () => {
  /** Huaraz with a spot folded into it, which is what makes deleting the city a refusal. */
  const cityWithSpot = async () => {
    const huaraz = unwrap(await commands().addPlace(city()));
    const spot = unwrap(
      await commands().addPlace(city({ kind: "poi", name: "Laguna 513", lat: -9.2112, lng: -77.5466, parent: { name: "Huaraz", lat: -9.52614, lng: -77.52869 } })),
    );
    return { huaraz, spot };
  };

  it("refuses a city that still has spots, deleting nothing", async () => {
    const { huaraz, spot } = await cityWithSpot();

    const result = await commands().deletePlace(huaraz.id);

    expect(result.ok ? null : result.error.code).toBe("city-still-has-spots");
    const peru = (await journey()).countryByCode.get("PE")!;
    expect(peru.cities.map((c) => [c.place.name, c.pois.map((p) => p.name)])).toEqual([["Huaraz", ["Laguna 513"]]]);
    expect((await journey()).placeById.get(spot.id)).toBeDefined();
  });

  it("locks the country again once its spots and then its city are deleted", async () => {
    const { huaraz, spot } = await cityWithSpot();

    expect((await commands().deletePlace(spot.id)).ok).toBe(true);
    const result = await commands().deletePlace(huaraz.id);

    expect(result.ok).toBe(true);
    // No places left in Peru, so the country isn't on the globe at all: it locks back into ASCII.
    const after = await journey();
    expect(after.countryByCode.get("PE")).toBeUndefined();
    expect(after.countries).toEqual([]);
  });

  it("deletes a spot's photos and their stored files", async () => {
    const { spot } = await cityWithSpot();
    const photo = unwrap(await uploadPhoto(spot.id, { caption: "the lake", takenAt: null, lat: null, lng: null }));
    const file = join(dir, "uploads", basename(photo.url));
    expect(existsSync(file)).toBe(true);

    const result = await commands().deletePlace(spot.id);

    expect(result.ok).toBe(true);
    expect(existsSync(file)).toBe(false);
    const after = await journey();
    expect(after.data.photos).toEqual([]);
    expect(after.cityOf.get(spot.id)).toBeUndefined();
  });

  it("deletes a city that has no spots, along with its photos and their files", async () => {
    const huaraz = unwrap(await commands().addPlace(city()));
    const photo = unwrap(await uploadPhoto(huaraz.id, { caption: "the plaza", takenAt: null, lat: null, lng: null }));
    const file = join(dir, "uploads", basename(photo.url));

    const result = await commands().deletePlace(huaraz.id);

    expect(result.ok).toBe(true);
    expect(existsSync(file)).toBe(false);
    expect((await journey()).countries).toEqual([]);
  });

  it("leaves every other place and its photos alone", async () => {
    const { huaraz, spot } = await cityWithSpot();
    const kept = unwrap(await uploadPhoto(huaraz.id, { caption: "the plaza", takenAt: null, lat: null, lng: null }));
    unwrap(await uploadPhoto(spot.id, { caption: "the lake", takenAt: null, lat: null, lng: null }));

    const result = await commands().deletePlace(spot.id);

    expect(result.ok).toBe(true);
    const after = await journey();
    expect(after.data.photos.map((p) => p.id)).toEqual([kept.id]);
    expect(existsSync(join(dir, "uploads", basename(kept.url)))).toBe(true);
    expect(after.countryByCode.get("PE")!.cities.map((c) => [c.place.name, c.pois.map((p) => p.name)])).toEqual([["Huaraz", []]]);
  });

  it("keeps a deleted place's trip and its other stops", async () => {
    const trip = unwrap(await commands().createTrip({ name: "South America 2025", story: "", startDate: null, endDate: null }));
    const huaraz = unwrap(await commands().addPlace(city({ tripId: trip.id })));
    unwrap(await commands().addPlace(city({ name: "Cusco", tripId: trip.id })));

    const result = await commands().deletePlace(huaraz.id);

    expect(result.ok).toBe(true);
    const after = await journey();
    expect(after.tripById.get(trip.id)).toEqual(trip);
    expect(tripStops(after, trip.id).map((p) => p.name)).toEqual(["Cusco"]);
  });

  it.each([
    ["deleting a place that doesn't exist", () => commands().deletePlace("nope"), "unknown-place"],
    ["a deletion sent as nothing at all", () => commands().deletePlace(null as never), "unknown-place"],
  ] as const)("refuses %s", async (_, run, code) => {
    const result = await run();
    expect(result.ok ? null : result.error.code).toBe(code);
  });
});

describe("uploads", () => {
  const resolved = async (placeId: string) =>
    (await journey()).storyByPlace.get(placeId)!.map((block) => (block.type === "text" ? block.text : block.photo.caption));

  /** A place with something already written, so a confirmed photo has a story to land at the end of. */
  const somewhere = async (story = "We set out at dawn.") => unwrap(await commands().addPlace(city({ story })));

  const confirmation = (uploadId: string, input: Partial<UploadConfirmation> = {}): UploadConfirmation => ({
    uploadId,
    caption: "the lake",
    takenAt: null,
    lat: null,
    lng: null,
    ...input,
  });

  it("records the photo at the end of the story once its bytes have arrived", async () => {
    const place = await somewhere();
    const target = unwrap(await commands().prepareUpload({ placeId: place.id, contentType: "image/jpeg" }));

    // What the browser does with a target: send the bytes to where it points, then say it's there.
    expect(await receiveLocalUpload(options(), target.uploadId, jpeg)).toBe("stored");
    const result = await commands().confirmUpload(confirmation(target.uploadId, { takenAt: "2025-06-07", lat: -9.2, lng: -77.5 }));

    expect(result.ok).toBe(true);
    expect(await resolved(place.id)).toEqual(["We set out at dawn.", "the lake"]);
    const photo = unwrap(result);
    expect([photo.placeId, photo.takenAt, photo.lat, photo.lng]).toEqual([place.id, "2025-06-07", -9.2, -77.5]);
  });

  it("hands out somewhere to send the bytes, good for this one file type", async () => {
    const place = await somewhere();

    const target = unwrap(await commands().prepareUpload({ placeId: place.id, contentType: "image/png" }));

    expect(target.url).toContain(target.uploadId);
    expect([target.method, target.headers["content-type"]]).toEqual(["PUT", "image/png"]);
  });

  /** The blocks as they're written down, which is what the story arranger offers to move. */
  const blocks = async (placeId: string) =>
    (await journey()).placeById.get(placeId)!.storyBlocks.map((b) => (b.type === "text" ? b.text : b.photoId));

  it("writes the photo into the story, so it's a block the owner can move", async () => {
    const place = await somewhere();
    const target = unwrap(await commands().prepareUpload({ placeId: place.id, contentType: "image/jpeg" }));
    await receiveLocalUpload(options(), target.uploadId, jpeg);

    const photo = unwrap(await commands().confirmUpload(confirmation(target.uploadId)));

    expect(await blocks(place.id)).toEqual(["We set out at dawn.", photo.id]);
  });

  it("keeps photos in the order they were uploaded", async () => {
    const place = await somewhere("");
    const climb = unwrap(await uploadPhoto(place.id, { caption: "the climb" }));

    const lake = unwrap(await uploadPhoto(place.id, { caption: "the lake" }));

    expect(await resolved(place.id)).toEqual(["the climb", "the lake"]);
    // Each one is written down as it's confirmed, so the newest reads last.
    expect(await blocks(place.id)).toEqual([climb.id, lake.id]);
  });

  it("hands out a target that expires shortly", async () => {
    const place = await somewhere();

    const target = unwrap(await commands().prepareUpload({ placeId: place.id, contentType: "image/jpeg" }));

    expect(target.expiresAt).toBeGreaterThan(Date.now());
    expect(target.expiresAt).toBeLessThanOrEqual(Date.now() + UPLOAD_TARGET_TTL_MS);
  });

  it("refuses to record a photo whose bytes never arrived", async () => {
    const place = await somewhere();
    const target = unwrap(await commands().prepareUpload({ placeId: place.id, contentType: "image/jpeg" }));

    const result = await commands().confirmUpload(confirmation(target.uploadId));

    expect(result.ok ? null : result.error.code).toBe("upload-not-found");
    expect(await resolved(place.id)).toEqual(["We set out at dawn."]);
  });

  it("won't take a file of a type the target wasn't for", async () => {
    const place = await somewhere();
    const target = unwrap(await commands().prepareUpload({ placeId: place.id, contentType: "image/jpeg" }));

    const received = await receiveLocalUpload(options(), target.uploadId, { bytes: new Uint8Array([1]), contentType: "image/png" });
    const result = await commands().confirmUpload(confirmation(target.uploadId));

    expect(received).toBe("wrong-content-type");
    // The bytes were turned away, so there's still nothing to confirm.
    expect(result.ok ? null : result.error.code).toBe("upload-not-found");
  });

  it("won't take bytes for a target that has run out, or record a photo for it", async () => {
    const stale = commands({ uploadTargetTtlMs: 0 });
    const place = await somewhere();
    const target = unwrap(await stale.prepareUpload({ placeId: place.id, contentType: "image/jpeg" }));

    const received = await receiveLocalUpload(options({ uploadTargetTtlMs: 0 }), target.uploadId, jpeg);
    const result = await stale.confirmUpload(confirmation(target.uploadId));

    expect(received).toBe("unknown-upload");
    expect(result.ok ? null : result.error.code).toBe("upload-not-found");
  });

  it("spends the target, so one upload can't be recorded twice", async () => {
    const place = await somewhere();
    const target = unwrap(await commands().prepareUpload({ placeId: place.id, contentType: "image/jpeg" }));
    await receiveLocalUpload(options(), target.uploadId, jpeg);
    unwrap(await commands().confirmUpload(confirmation(target.uploadId)));

    const again = await commands().confirmUpload(confirmation(target.uploadId, { caption: "the lake again" }));

    expect(again.ok ? null : again.error.code).toBe("upload-not-found");
    expect(await resolved(place.id)).toEqual(["We set out at dawn.", "the lake"]);
  });

  it.each([
    [
      "a file type that isn't an image we allow",
      async () => commands().prepareUpload({ placeId: (await somewhere()).id, contentType: "image/svg+xml" }),
      "unsupported-file-type",
    ],
    ["a target for a place that doesn't exist", () => commands().prepareUpload({ placeId: "nope", contentType: "image/jpeg" }), "unknown-place"],
    ["a target sent as nothing at all", () => commands().prepareUpload(null as never), "unknown-place"],
    ["an upload id that was never handed out", () => commands().confirmUpload(confirmation("nope")), "upload-not-found"],
    ["a confirmation sent as nothing at all", () => commands().confirmUpload(null as never), "upload-not-found"],
    [
      "a confirmed photo with a malformed date",
      async () => {
        const place = await somewhere();
        const target = unwrap(await commands().prepareUpload({ placeId: place.id, contentType: "image/jpeg" }));
        await receiveLocalUpload(options(), target.uploadId, jpeg);
        return commands().confirmUpload(confirmation(target.uploadId, { takenAt: "yesterday" }));
      },
      "invalid-date",
    ],
  ] as const)("refuses %s", async (_, run, code) => {
    const result = await run();
    expect(result.ok ? null : result.error.code).toBe(code);
  });
});

