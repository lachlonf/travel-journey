"use client";

import type { CityResult } from "@/app/api/cities/route";
import type { PlaceInput } from "@/lib/admin-commands";
import type { LatLng } from "@/lib/types";
import { CitySearch } from "./CitySearch";

/** Coordinates are null for a custom name, which then sits at the spot itself. */
export interface Parent {
  name: string;
  lat: number | null;
  lng: number | null;
}

export const noParent: Parent = { name: "", lat: null, lng: null };

export const parentInput = (parent: Parent, spot: LatLng): NonNullable<PlaceInput["parent"]> => ({
  name: parent.name,
  lat: parent.lat ?? spot.lat,
  lng: parent.lng ?? spot.lng,
});

interface ParentCityFieldProps {
  id: string;
  parent: Parent;
  /** Offered as a one-click switch whenever it differs from the chosen city. */
  nearest: CityResult | null;
  onChange: (parent: Parent) => void;
  hint: string;
}

/** The city a specific spot folds into. */
export function ParentCityField({ id, parent, nearest, onChange, hint }: ParentCityFieldProps) {
  return (
    <CitySearch
      id={id}
      label="Folds into city"
      value={parent.name}
      onChange={(text) => onChange({ name: text, lat: null, lng: null })}
      onPick={(city) => onChange({ name: city.name, lat: city.lat, lng: city.lng })}
      required
      hint={
        nearest && parent.name !== nearest.name ? (
          <>
            Nearest in the database:{" "}
            <button type="button" onClick={() => onChange({ name: nearest.name, lat: nearest.lat, lng: nearest.lng })}>
              {nearest.name}
            </button>
          </>
        ) : (
          hint
        )
      }
    />
  );
}
