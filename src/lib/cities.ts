export interface City {
  name: string;
  lat: number;
  lng: number;
  countryCode: string;
}

/** A row as shipped in the cities.json package. */
export interface RawCity {
  name: string;
  lat: string;
  lng: string;
  country: string;
}

export const toCity = (raw: RawCity): City => ({
  name: raw.name,
  lat: Number(raw.lat),
  lng: Number(raw.lng),
  countryCode: raw.country,
});

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Folding 170k names per keystroke is wasteful, so do it once per list.
const foldedNames = new WeakMap<readonly City[], string[]>();

export function searchCities(cities: readonly City[], query: string, limit = 8): City[] {
  const q = fold(query.trim());
  if (!q) return [];

  let names = foldedNames.get(cities);
  if (!names) foldedNames.set(cities, (names = cities.map((c) => fold(c.name))));

  const exact: City[] = [];
  const prefix: City[] = [];
  const inside: City[] = [];
  names.forEach((name, i) => {
    if (name === q) exact.push(cities[i]);
    else if (name.startsWith(q)) prefix.push(cities[i]);
    else if (name.includes(q)) inside.push(cities[i]);
  });
  return [...exact, ...prefix, ...inside].slice(0, limit);
}
