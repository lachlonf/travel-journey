import { toCity, type City, type RawCity } from "./cities";

let cities: Promise<City[]> | undefined;

/** ~170k cities, loaded once per server instance on first use. */
export function loadCities(): Promise<City[]> {
  cities ??= import("cities.json").then((module) => (module.default as unknown as RawCity[]).map(toCity));
  return cities;
}
