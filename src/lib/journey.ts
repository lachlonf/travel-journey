import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import { centroid, spreadKm } from "./geo";
import type { JourneyData, LatLng, Photo, Place, StoryBlock, Trip } from "./types";

countries.registerLocale(en);

export const countryName = (code: string) => countries.getName(code, "en") ?? code;

export interface CityNode {
  place: Place;
  pois: Place[];
}

export interface CountryNode {
  /** ISO alpha-2. */
  code: string;
  /** ISO numeric, as used by world-atlas feature ids. */
  numericId: string | null;
  name: string;
  center: LatLng;
  spreadKm: number;
  dateRange: { from: string; to: string } | null;
  cities: CityNode[];
  tripIds: string[];
}

/** A story block as visitors read it: photo blocks carry the photo itself. */
export type ResolvedStoryBlock = Extract<StoryBlock, { type: "text" }> | { type: "photo"; photo: Photo };

/** The read-side shape of the journey: countries → cities → POIs, plus lookups. */
export interface Journey {
  data: JourneyData;
  countries: CountryNode[];
  countryByCode: Map<string, CountryNode>;
  placeById: Map<string, Place>;
  /** Every place id (city or POI) → the city node it lives under. */
  cityOf: Map<string, CityNode>;
  /** Each place's resolved story, the only thing the story panel renders. */
  storyByPlace: Map<string, ResolvedStoryBlock[]>;
  photosByPlace: Map<string, Photo[]>;
  tripById: Map<string, Trip>;
}

const firstVisit = (p: Place) => [...p.visitedOn].sort()[0];

function resolveStory(place: Place, photos: readonly Photo[]): ResolvedStoryBlock[] {
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const shown = new Set<Photo>();
  const story: ResolvedStoryBlock[] = [];
  for (const block of place.storyBlocks) {
    if (block.type === "text") {
      story.push({ type: "text", text: block.text });
      continue;
    }
    // A block for a photo that's gone is skipped rather than shown broken.
    const photo = photoById.get(block.photoId);
    if (!photo || shown.has(photo)) continue;
    shown.add(photo);
    story.push({ type: "photo", photo });
  }
  // Nothing uploaded is ever hidden: photos no block references go at the end, in upload order.
  for (const photo of photos) if (!shown.has(photo)) story.push({ type: "photo", photo });
  return story;
}

export function buildJourney(data: JourneyData): Journey {
  const placeById = new Map(data.places.map((p) => [p.id, p]));
  const hasParentCity = (p: Place) => p.kind === "poi" && p.parentId !== null && placeById.get(p.parentId)?.kind === "city";

  const cityOf = new Map<string, CityNode>();
  for (const p of data.places) if (!hasParentCity(p)) cityOf.set(p.id, { place: p, pois: [] });
  for (const p of data.places) {
    if (!hasParentCity(p)) continue;
    const city = cityOf.get(p.parentId!)!;
    city.pois.push(p);
    cityOf.set(p.id, city);
  }

  const citiesByCountry = new Map<string, CityNode[]>();
  for (const node of new Set(cityOf.values())) {
    const code = node.place.countryCode;
    citiesByCountry.set(code, [...(citiesByCountry.get(code) ?? []), node]);
  }

  const tripOrder = data.trips.map((t) => t.id);
  const countryNodes = [...citiesByCountry].map(([code, cities]): CountryNode => {
    const places = cities.flatMap((c) => [c.place, ...c.pois]);
    const dates = places.flatMap((p) => p.visitedOn).sort();
    const center = centroid(places);
    const numeric = countries.alpha2ToNumeric(code);
    return {
      code,
      numericId: numeric ? String(numeric).padStart(3, "0") : null,
      name: countryName(code),
      center,
      spreadKm: spreadKm(center, places),
      dateRange: dates.length ? { from: dates[0], to: dates.at(-1)! } : null,
      cities,
      tripIds: tripOrder.filter((id) => places.some((p) => p.tripId === id)),
    };
  });
  countryNodes.sort((a, b) => a.name.localeCompare(b.name));

  const uploadedByPlace = new Map<string, Photo[]>();
  for (const photo of data.photos) uploadedByPlace.set(photo.placeId, [...(uploadedByPlace.get(photo.placeId) ?? []), photo]);
  const storyByPlace = new Map(data.places.map((p) => [p.id, resolveStory(p, uploadedByPlace.get(p.id) ?? [])]));

  // A photo's position is where the story shows it.
  const photosByPlace = new Map<string, Photo[]>();
  for (const [placeId, story] of storyByPlace) {
    const photos = story.flatMap((block) => (block.type === "photo" ? [block.photo] : []));
    if (photos.length) photosByPlace.set(placeId, photos);
  }

  return {
    data,
    countries: countryNodes,
    countryByCode: new Map(countryNodes.map((c) => [c.code, c])),
    placeById,
    cityOf,
    storyByPlace,
    photosByPlace,
    tripById: new Map(data.trips.map((t) => [t.id, t])),
  };
}

/** A trip's places in the order you visited them; undated places go last. */
export function tripStops(journey: Journey, tripId: string): Place[] {
  return journey.data.places
    .filter((p) => p.tripId === tripId)
    .sort((a, b) => {
      const [fa, fb] = [firstVisit(a), firstVisit(b)];
      if (fa === fb) return 0;
      if (fa === undefined) return 1;
      if (fb === undefined) return -1;
      return fa < fb ? -1 : 1;
    });
}

/** The countries a trip passes through, in the order it first reaches them. */
export function tripCountries(journey: Journey, tripId: string): CountryNode[] {
  const codes = new Set(tripStops(journey, tripId).map((p) => journey.cityOf.get(p.id)!.place.countryCode));
  return [...codes].map((code) => journey.countryByCode.get(code)!);
}

export function findCityPlace(places: readonly Place[], name: string, countryCode: string): Place | undefined {
  const wanted = name.trim().toLowerCase();
  return places.find((p) => p.kind === "city" && p.countryCode === countryCode && p.name.toLowerCase() === wanted);
}
