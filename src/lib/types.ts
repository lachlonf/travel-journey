export type PlaceKind = "city" | "poi";

/** An optional story that strings places together, possibly across countries. */
export interface Trip {
  id: string;
  name: string;
  story: string;
  startDate: string | null;
  endDate: string | null;
}

/**
 * A checkpoint on the globe. Cities are level-2 pins; POIs are level-3 pins
 * that get absorbed into their parent city when zoomed out.
 */
export interface Place {
  id: string;
  kind: PlaceKind;
  name: string;
  lat: number;
  lng: number;
  /** ISO 3166-1 alpha-2, e.g. "PE". */
  countryCode: string;
  /** For POIs: the city they collapse into. Always null for cities. */
  parentId: string | null;
  tripId: string | null;
  /** ISO dates (YYYY-MM-DD). A list, because you can go back. */
  visitedOn: string[];
  story: string;
}

export interface Photo {
  id: string;
  placeId: string;
  url: string;
  caption: string;
  takenAt: string | null;
  lat: number | null;
  lng: number | null;
  sortOrder: number;
}

export interface JourneyData {
  trips: Trip[];
  places: Place[];
  photos: Photo[];
}

export interface LatLng {
  lat: number;
  lng: number;
}
