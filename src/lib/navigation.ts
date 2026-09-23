import { centroid, clamp, spreadKm } from "./geo";
import type { CityNode, Journey } from "./journey";
import type { Place } from "./types";

/** Where the globe is: the three drill-in levels. */
export type Nav =
  | { level: "world" }
  | { level: "country"; country: string }
  | { level: "city"; country: string; cityId: string };

/** What rests over the globe before anywhere has been chosen. */
export type Overlay = "landing" | "trips" | null;

export interface View {
  nav: Nav;
  /** The place whose story panel is open, if any. */
  openPlaceId: string | null;
  /**
   * Whether that story has taken over the screen as a full page. The panel is
   * the preview; reading is where the writing and the photographs get room.
   */
  reading: boolean;
  overlay: Overlay;
}

export type NavAction =
  | { type: "openCountry"; country: string }
  | { type: "openCity"; cityId: string }
  | { type: "openPlace"; placeId: string }
  | { type: "readStory" }
  | { type: "openTrips" }
  | { type: "landing" }
  | { type: "explore" }
  | { type: "back" };

export interface Pin {
  id: string;
  kind: "country" | "city" | "spot";
  label: string;
  lat: number;
  lng: number;
}

export interface CameraTarget {
  /** Null keeps the camera's current direction. */
  lat: number | null;
  lng: number | null;
  altitude: number;
}

/** The globe with nothing over it: what the Explore choice leads to. */
export const exploringView: View = { nav: { level: "world" }, openPlaceId: null, reading: false, overlay: null };

/** The site opens on the landing, which is the same world with a title over it. */
export const initialView: View = { ...exploringView, overlay: "landing" };

export const WORLD_ALTITUDE = 2.2;
/** Km of spread that fills the view at altitude 1, for a 45° field of view with some margin. */
const KM_PER_ALTITUDE = 1650;

const cityNav = (node: CityNode): Nav => ({ level: "city", country: node.place.countryCode, cityId: node.place.id });

export function navigate(journey: Journey, view: View, action: NavAction): View {
  switch (action.type) {
    case "openCountry":
      return journey.countryByCode.has(action.country)
        ? { ...exploringView, nav: { level: "country", country: action.country } }
        : view;
    case "openCity": {
      const node = journey.cityOf.get(action.cityId);
      if (node?.place.id !== action.cityId) return view;
      // Nothing to choose between, so go straight to the story.
      return { ...exploringView, nav: cityNav(node), openPlaceId: node.spots.length ? null : node.place.id };
    }
    case "openPlace": {
      const node = journey.cityOf.get(action.placeId);
      // Reading carries over, so a nearby place opened from the full page stays a full page.
      return node ? { ...exploringView, nav: cityNav(node), openPlaceId: action.placeId, reading: view.reading } : view;
    }
    case "readStory":
      return view.openPlaceId && !view.reading ? { ...view, reading: true } : view;
    // An overlay always rests on the world, never over a country you had drilled into.
    case "landing":
      return initialView;
    case "openTrips":
      return view.overlay === "trips" ? view : { ...initialView, overlay: "trips" };
    case "explore":
      return view.overlay === null ? view : { ...view, overlay: null };
    case "back": {
      const { nav } = view;
      // Outwards one layer at a time: the trips panel, the full page, the preview, the globe, the landing.
      if (view.overlay === "trips") return { ...view, overlay: "landing" };
      if (view.reading) return { ...view, reading: false };
      if (view.openPlaceId) return { ...view, openPlaceId: null };
      if (nav.level === "city") return { ...exploringView, nav: { level: "country", country: nav.country } };
      if (nav.level === "country") return exploringView;
      return view;
    }
  }
}

const placePin = (place: Place, kind: Pin["kind"]): Pin => ({ id: place.id, kind, label: place.name, lat: place.lat, lng: place.lng });

export function visiblePins(journey: Journey, nav: Nav): Pin[] {
  if (nav.level === "world") {
    return journey.countries.map((c) => ({ id: c.code, kind: "country", label: c.name, lat: c.center.lat, lng: c.center.lng }));
  }
  if (nav.level === "country") {
    return (journey.countryByCode.get(nav.country)?.cities ?? []).map((node) => placePin(node.place, "city"));
  }
  const node = journey.cityOf.get(nav.cityId);
  return node ? [placePin(node.place, "city"), ...node.spots.map((p) => placePin(p, "spot"))] : [];
}

export function cameraTarget(journey: Journey, nav: Nav): CameraTarget {
  if (nav.level === "country") {
    const country = journey.countryByCode.get(nav.country);
    if (country) {
      return { ...country.center, altitude: clamp(country.spreadKm / KM_PER_ALTITUDE, 0.25, 1.5) };
    }
  }
  if (nav.level === "city") {
    const node = journey.cityOf.get(nav.cityId);
    if (node) {
      const places = [node.place, ...node.spots];
      const center = centroid(places);
      return { ...center, altitude: clamp(spreadKm(center, places) / KM_PER_ALTITUDE, 0.02, 0.25) };
    }
  }
  return { lat: null, lng: null, altitude: WORLD_ALTITUDE };
}
