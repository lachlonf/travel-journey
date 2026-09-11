import { describe, expect, it } from "vitest";
import { searchCities, toCity } from "./cities";

const city = (name: string, countryCode = "PE") => ({ name, lat: 0, lng: 0, countryCode });
const cities = [
  city("San Cristóbal de las Casas", "MX"),
  city("Cusco"),
  city("Sant Julià de Lòria", "AD"),
  city("Carhuaz"),
  city("Huaraz"),
];

describe("toCity", () => {
  it("converts a raw cities.json row", () => {
    expect(toCity({ name: "Huaraz", lat: "-9.52614", lng: "-77.52869", country: "PE" })).toEqual({
      name: "Huaraz",
      lat: -9.52614,
      lng: -77.52869,
      countryCode: "PE",
    });
  });
});

describe("searchCities", () => {
  it("matches ignoring case and accents", () => {
    expect(searchCities(cities, "cus").map((c) => c.name)).toEqual(["Cusco"]);
    expect(searchCities(cities, "JULIA").map((c) => c.name)).toEqual(["Sant Julià de Lòria"]);
  });

  it("ranks prefix matches before matches inside the name, and respects the limit", () => {
    expect(searchCities(cities, "ca").map((c) => c.name)).toEqual(["Carhuaz", "San Cristóbal de las Casas"]);
    expect(searchCities(cities, "ca", 1)).toHaveLength(1);
  });

  it("puts exact name matches ahead of longer names that share the prefix", () => {
    const list = [city("Huaraz Chico"), city("Cuscoville"), city("Cusco")];
    expect(searchCities(list, "cusco").map((c) => c.name)).toEqual(["Cusco", "Cuscoville"]);
  });

  it("returns nothing for a blank query", () => {
    expect(searchCities(cities, "  ")).toEqual([]);
  });
});
