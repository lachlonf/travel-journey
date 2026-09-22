import { centroid, clamp, spreadKm } from "./geo";
import type { CityNode, Journey } from "./journey";
import type { Place } from "./types";

/** Where the globe is: the three drill-in levels. */
export type Nav =
  | { level: "world" }
  | { level: "country"; country: string }
  | { level: "city"; country: string; cityId: string };

export interface View {
  nav: Nav;
  /** The place whose story panel is open, if any. */
  openPlaceId: string | null;
}

export type NavAction =
  | { type: "openCountry"; country: string }
  | { type: "openCity"; cityId: string }
  | { type: "openPlace"; placeId: string }
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

export const initialView: View = { nav: { level: "world" }, openPlaceId: null };

export const WORLD_ALTITUDE = 2.2;
/** Km of spread that fills the view at altitude 1, for a 45° field of view with some margin. */
const KM_PER_ALTITUDE = 1650;

const cityNav = (node: CityNode): Nav => ({ level: "city", country: node.place.countryCode, cityId: node.place.id });

export function navigate(journey: Journey, view: View, action: NavAction): View {
  switch (action.type) {
    case "openCountry":
      return journey.countryByCode.has(action.country)
        ? { nav: { level: "country", country: action.country }, openPlaceId: null }
        : view;
    case "openCity": {
      const node = journey.cityOf.get(action.cityId);
      if (node?.place.id !== action.cityId) return view;
      // Nothing to choose between, so go straight to the story.
      return { nav: cityNav(node), openPlaceId: node.spots.length ? null : node.place.id };
    }
    case "openPlace": {
      const node = journey.cityOf.get(action.placeId);
      return node ? { nav: cityNav(node), openPlaceId: action.placeId } : view;
    }
    case "back": {
      const { nav } = view;
      if (view.openPlaceId) return { ...view, openPlaceId: null };
      if (nav.level === "city") return { nav: { level: "country", country: nav.country }, openPlaceId: null };
      if (nav.level === "country") return initialView;
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
