import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixture } from "../__fixtures__/journey";
import { buildJourney } from "../journey";
import { createLocalRepository } from "./local";

let dir: string;
const open = () =>
  createLocalRepository({
    dataFile: join(dir, "data", "journey.json"),
    seedFile: join(dir, "seed.json"),
    uploadsDir: join(dir, "uploads"),
    publicUrlPrefix: "/uploads",
  });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "journey-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("local repository", () => {
  it("starts empty when there is no seed", async () => {
    expect(await open().load()).toEqual({ trips: [], places: [], photos: [] });
  });

  it("starts from the seed and persists trips and places across instances", async () => {
    await writeFile(join(dir, "seed.json"), JSON.stringify(fixture));
    const trip = await open().createTrip({ name: "Japan 2026", story: "", startDate: null, endDate: null });
    // A whole Place, id and all: the store must still assign its own id.
    const place = await open().createPlace(fixture.places[0]);

    const data = await open().load();
    expect(data.trips.map((t) => t.id)).toEqual(["t-sa", trip.id]);
    expect(data.places.at(-1)).toEqual(place);
    expect(place.id).not.toBe(fixture.places[0].id);
  });

  it("changes only the fields an update gives it", async () => {
    const place = await open().createPlace(fixture.places[0]);

    const updated = await open().updatePlace(place.id, { name: "Huaráz", tripId: null });

    expect(updated).toEqual({ ...place, name: "Huaráz", tripId: null });
    expect((await open().load()).places).toEqual([updated]);
  });

  it("refuses to update a place that isn't there", async () => {
    await expect(open().updatePlace("nope", { name: "Nowhere" })).rejects.toThrow("No place with id nope");
  });

  it("changes only the fields a trip update gives it", async () => {
    const trip = await open().createTrip({ name: "Japan 2026", story: "", startDate: null, endDate: null });

    const updated = await open().updateTrip(trip.id, { name: "Japan 2026, the long way", endDate: "2026-04-10" });

    expect(updated).toEqual({ ...trip, name: "Japan 2026, the long way", endDate: "2026-04-10" });
    expect((await open().load()).trips).toEqual([updated]);
  });

  it("refuses to update a trip that isn't there", async () => {
    await expect(open().updateTrip("nope", { name: "Nowhere" })).rejects.toThrow("No trip with id nope");
  });

  it("keeps a deleted trip's places, no longer on a trip", async () => {
    const trip = await open().createTrip({ name: "Japan 2026", story: "", startDate: null, endDate: null });
    const place = await open().createPlace({ ...fixture.places[0], tripId: trip.id });

    await open().deleteTrip(trip.id);

    const data = await open().load();
    expect(data.trips).toEqual([]);
    expect(data.places).toEqual([{ ...place, tripId: null }]);
  });

  // Before story blocks, a place's story was one text and each photo carried a sort order.
  const oldPlace = { kind: "city", lat: -9.5, lng: -77.5, countryCode: "PE", parentId: null, tripId: null, visitedOn: [] };
  const oldPhoto = { caption: "", takenAt: null, lat: null, lng: null };
  const oldJourney = {
    trips: [],
    places: [
      { ...oldPlace, id: "huaraz", name: "Huaraz", story: "Arrived in the rain.\n\nThe lake was worth it." },
      { ...oldPlace, id: "cusco", name: "Cusco", story: "" },
    ],
    photos: [
      { ...oldPhoto, id: "p1", placeId: "huaraz", url: "/a.jpg", sortOrder: 1 },
      { ...oldPhoto, id: "p2", placeId: "huaraz", url: "/b.jpg", sortOrder: 0 },
    ],
  };

  it.each([
    ["the seed", "seed.json"],
    ["saved edits", join("data", "journey.json")],
  ])("upgrades old stories in %s to the story text followed by the photos in their old order", async (_, file) => {
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await writeFile(join(dir, file), JSON.stringify(oldJourney));

    const journey = buildJourney(await open().load());
    const story = (placeId: string) =>
      journey.storyByPlace.get(placeId)!.map((block) => (block.type === "text" ? ["text", block.text] : ["photo", block.photo.id]));
    expect(story("huaraz")).toEqual([
      ["text", "Arrived in the rain.\n\nThe lake was worth it."],
      ["photo", "p2"],
      ["photo", "p1"],
    ]);
    expect(story("cusco")).toEqual([]);
  });

  it("stores uploaded photo bytes and serves them from the public prefix", async () => {
    const photo = await open().addPhoto(
      { placeId: "huaraz", caption: "the lake", takenAt: "2025-06-07", lat: -9.2, lng: -77.5 },
      { bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" },
    );

    expect(photo.url).toMatch(/^\/uploads\/[\w-]+\.jpg$/);
    const bytes = await readFile(join(dir, "uploads", photo.url.replace("/uploads/", "")));
    expect([...bytes]).toEqual([1, 2, 3]);
    expect((await open().load()).photos).toEqual([photo]);
  });
});
