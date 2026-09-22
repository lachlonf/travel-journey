import { describe, expect, it } from "vitest";
import { fixture } from "./__fixtures__/journey";
import { buildJourney, findCityPlace, tripCountries, tripStops } from "./journey";

const journey = buildJourney(fixture);
const country = (code: string) => journey.countries.find((c) => c.code === code)!;

describe("buildJourney", () => {
  it("unlocks every country that has a place, sorted by name", () => {
    expect(journey.countries.map((c) => c.code)).toEqual(["AU", "BO", "PE"]);
    expect(country("PE").name).toBe("Peru");
    expect(country("PE").numericId).toBe("604");
  });

  it("groups spots under their parent city, promoting orphans to cities", () => {
    const cities = country("PE").cities;
    expect(cities.map((c) => c.place.id).sort()).toEqual(["cusco", "huaraz", "orphan"]);
    expect(cities.find((c) => c.place.id === "huaraz")!.spots.map((p) => p.id)).toEqual(["laguna513"]);
  });

  it("derives each country's visited date range, ignoring undated places", () => {
    expect(country("PE").dateRange).toEqual({ from: "2025-06-05", to: "2025-06-20" });
    expect(country("AU").dateRange).toEqual({ from: "2019-12-24", to: "2023-01-02" });
  });

  it("lists the trips that pass through each country", () => {
    expect(country("PE").tripIds).toEqual(["t-sa"]);
    expect(country("AU").tripIds).toEqual([]);
  });

  it("indexes photos by place in the order their story shows them", () => {
    expect(journey.photosByPlace.get("huaraz")!.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(journey.photosByPlace.get("cusco")).toBeUndefined();
  });
});

describe("resolved stories", () => {
  const story = (placeId: string) =>
    journey.storyByPlace.get(placeId)!.map((block) => (block.type === "text" ? ["text", block.text] : ["photo", block.photo.id]));

  it("reads a place's story blocks in order, with photo blocks resolved to photos", () => {
    expect(story("huaraz").slice(0, 3)).toEqual([
      ["text", "Arrived in the rain."],
      ["photo", "p2"],
      ["text", "The lake was worth it."],
    ]);
    expect(journey.storyByPlace.get("huaraz")![1]).toMatchObject({ photo: { url: "/b.jpg" } });
  });

  it("drops blocks pointing at missing photos and appends photos no block references", () => {
    expect(story("huaraz")).toEqual([
      ["text", "Arrived in the rain."],
      ["photo", "p2"],
      ["text", "The lake was worth it."],
      ["photo", "p1"],
    ]);
  });

  it("is empty for a place with nothing written or uploaded", () => {
    expect(story("cusco")).toEqual([]);
  });
});

describe("tripStops", () => {
  it("orders a trip's places by first visit, across countries", () => {
    expect(tripStops(journey, "t-sa").map((p) => p.id)).toEqual(["huaraz", "laguna513", "cusco", "lapaz"]);
  });

  it("is empty for an unknown trip", () => {
    expect(tripStops(journey, "nope")).toEqual([]);
  });
});

describe("tripCountries", () => {
  it("lists the countries a trip passes through, in the order it reaches them", () => {
    expect(tripCountries(journey, "t-sa").map((c) => c.code)).toEqual(["PE", "BO"]);
    expect(tripCountries(journey, "nope")).toEqual([]);
  });
});

describe("findCityPlace", () => {
  it("matches an existing city by name within a country, case-insensitively", () => {
    expect(findCityPlace(fixture.places, "huaraz", "PE")?.id).toBe("huaraz");
    expect(findCityPlace(fixture.places, "Huaraz", "BO")).toBeUndefined();
    expect(findCityPlace(fixture.places, "Laguna 513", "PE")).toBeUndefined();
  });
});
