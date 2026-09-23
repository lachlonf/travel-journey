import { describe, expect, it } from "vitest";
import { fixture } from "./__fixtures__/journey";
import { buildJourney } from "./journey";
import { cameraTarget, exploringView, initialView, navigate, visiblePins, type View } from "./navigation";

const journey = buildJourney(fixture);
const go = (view: View, ...actions: Parameters<typeof navigate>[2][]) =>
  actions.reduce((v, a) => navigate(journey, v, a), view);

describe("navigate", () => {
  it("drills from world to country to city", () => {
    const inCountry = go(initialView, { type: "openCountry", country: "PE" });
    expect(inCountry).toEqual({ nav: { level: "country", country: "PE" }, openPlaceId: null, reading: false, overlay: null });

    const inCity = go(inCountry, { type: "openCity", cityId: "huaraz" });
    expect(inCity).toEqual({ nav: { level: "city", country: "PE", cityId: "huaraz" }, openPlaceId: null, reading: false, overlay: null });
  });

  it("opens a city's story straight away when it has no spots to pick from", () => {
    expect(go(initialView, { type: "openCity", cityId: "cusco" })).toEqual({
      nav: { level: "city", country: "PE", cityId: "cusco" },
      openPlaceId: "cusco",
      reading: false,
      overlay: null,
    });
  });

  it("jumps straight to any place, landing on its city", () => {
    expect(go(initialView, { type: "openPlace", placeId: "laguna513" })).toEqual({
      nav: { level: "city", country: "PE", cityId: "huaraz" },
      openPlaceId: "laguna513",
      reading: false,
      overlay: null,
    });
    expect(go(initialView, { type: "openPlace", placeId: "sydney" }).nav).toEqual({
      level: "city",
      country: "AU",
      cityId: "sydney",
    });
  });

  it("backs out one step at a time: story, then city, then country", () => {
    const deep = go(initialView, { type: "openPlace", placeId: "laguna513" });
    const closed = go(deep, { type: "back" });
    expect(closed).toEqual({ ...deep, openPlaceId: null });
    expect(go(closed, { type: "back" }).nav).toEqual({ level: "country", country: "PE" });
    expect(go(closed, { type: "back" }, { type: "back" })).toEqual(exploringView);
    expect(go(exploringView, { type: "back" })).toBe(exploringView);
    expect(go(initialView, { type: "back" })).toBe(initialView);
  });

  it("ignores unknown targets", () => {
    expect(go(initialView, { type: "openCountry", country: "FR" })).toBe(initialView);
    expect(go(initialView, { type: "openPlace", placeId: "nope" })).toBe(initialView);
  });
});

describe("the landing's two choices", () => {
  it("opens on the landing, over the world", () => {
    expect(initialView).toEqual({ nav: { level: "world" }, openPlaceId: null, reading: false, overlay: "landing" });
  });

  it("clears the landing to explore, leaving the globe where it is", () => {
    expect(go(initialView, { type: "explore" })).toEqual(exploringView);
  });

  it("lays the trips panel over the world, wherever it was asked for", () => {
    const expected = { nav: { level: "world" }, openPlaceId: null, reading: false, overlay: "trips" };
    expect(go(initialView, { type: "openTrips" })).toEqual(expected);
    const deep = go(initialView, { type: "openPlace", placeId: "laguna513" });
    expect(go(deep, { type: "openTrips" })).toEqual(expected);
  });

  it("goes back from the trips panel to the landing", () => {
    expect(go(initialView, { type: "openTrips" }, { type: "back" })).toEqual(initialView);
  });

  it("puts the landing away when a place is opened from under it", () => {
    for (const overlay of [initialView, go(initialView, { type: "openTrips" })]) {
      expect(go(overlay, { type: "openCountry", country: "PE" })).toEqual({
        nav: { level: "country", country: "PE" },
        openPlaceId: null,
        reading: false,
        overlay: null,
      });
    }
  });

  it("returns to the landing from anywhere, keeping the world beneath", () => {
    const deep = go(initialView, { type: "openPlace", placeId: "laguna513" });
    expect(go(deep, { type: "landing" })).toEqual(initialView);
  });

  it("does nothing when a choice is made twice, or made while exploring", () => {
    const trips = go(initialView, { type: "openTrips" });
    expect(go(trips, { type: "openTrips" })).toBe(trips);
    expect(go(exploringView, { type: "explore" })).toBe(exploringView);
  });
});

describe("visiblePins", () => {
  it("shows countries at world level", () => {
    expect(visiblePins(journey, { level: "world" }).map((p) => [p.kind, p.id])).toEqual([
      ["country", "AU"],
      ["country", "BO"],
      ["country", "PE"],
    ]);
  });

  it("shows cities at country level, with spots absorbed", () => {
    const ids = visiblePins(journey, { level: "country", country: "PE" }).map((p) => p.id);
    expect(ids.sort()).toEqual(["cusco", "huaraz", "orphan"]);
  });

  it("shows the city and its spots at city level", () => {
    expect(visiblePins(journey, { level: "city", country: "PE", cityId: "huaraz" }).map((p) => [p.kind, p.id])).toEqual([
      ["city", "huaraz"],
      ["spot", "laguna513"],
    ]);
  });
});

describe("cameraTarget", () => {
  it("gets closer at each level", () => {
    const world = cameraTarget(journey, { level: "world" });
    const country = cameraTarget(journey, { level: "country", country: "PE" });
    const city = cameraTarget(journey, { level: "city", country: "PE", cityId: "huaraz" });
    expect(world.altitude).toBeGreaterThan(country.altitude);
    expect(country.altitude).toBeGreaterThan(city.altitude);
  });

  it("keeps the current direction at world level and centres on the places below", () => {
    expect(cameraTarget(journey, { level: "world" })).toMatchObject({ lat: null, lng: null });
    const city = cameraTarget(journey, { level: "city", country: "PE", cityId: "huaraz" });
    expect(Math.abs(city.lat! - -9.37)).toBeLessThan(0.1);
    expect(Math.abs(city.lng! - -77.54)).toBeLessThan(0.1);
  });
});

describe("reading a story as a full page", () => {
  const preview = go(initialView, { type: "openPlace", placeId: "laguna513" });

  it("takes the open story over the screen, leaving the globe where it was", () => {
    const reading = go(preview, { type: "readStory" });
    expect(reading).toEqual({ ...preview, reading: true });
  });

  it("has nothing to read until a story is open", () => {
    expect(go(initialView, { type: "readStory" })).toBe(initialView);
    const inCountry = go(initialView, { type: "openCountry", country: "PE" });
    expect(go(inCountry, { type: "readStory" })).toBe(inCountry);
  });

  it("leaves the story for the preview it was opened from", () => {
    expect(go(preview, { type: "readStory" }, { type: "back" })).toEqual(preview);
  });

  it("stays on the full page when another place is opened from within it", () => {
    const reading = go(preview, { type: "readStory" });
    expect(go(reading, { type: "openPlace", placeId: "huaraz" })).toEqual({
      nav: { level: "city", country: "PE", cityId: "huaraz" },
      openPlaceId: "huaraz",
      reading: true,
      overlay: null,
    });
  });

  it("closes the full page whenever the globe moves or an overlay opens", () => {
    const reading = go(preview, { type: "readStory" });
    for (const action of [
      { type: "openCountry", country: "PE" },
      { type: "openCity", cityId: "huaraz" },
      { type: "landing" },
      { type: "openTrips" },
    ] as const) {
      expect(go(reading, action).reading).toBe(false);
    }
  });
});
