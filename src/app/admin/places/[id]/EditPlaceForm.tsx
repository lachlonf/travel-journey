"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { updatePlace } from "@/app/admin/actions";
import { CoordinateFields } from "@/app/admin/CoordinateFields";
import { FormStatus } from "@/app/admin/FormStatus";
import { ParentCityField, noParent, parentInput, type Parent } from "@/app/admin/ParentCityField";
import { useNearestCity } from "@/app/admin/useNearestCity";
import type { Place, Trip } from "@/lib/types";

interface EditPlaceFormProps {
  place: Place;
  /** The city a specific spot folds into now; null for cities. */
  parentCity: Place | null;
  trips: Trip[];
}

export function EditPlaceForm({ place, parentCity, trips }: EditPlaceFormProps) {
  const router = useRouter();
  const isSpot = place.kind === "poi";
  const [name, setName] = useState(place.name);
  const [lat, setLat] = useState(String(place.lat));
  const [lng, setLng] = useState(String(place.lng));
  const [countryCode, setCountryCode] = useState(place.countryCode);
  const [parent, setParent] = useState<Parent>(parentCity ? { name: parentCity.name, lat: parentCity.lat, lng: parentCity.lng } : noParent);
  const [tripId, setTripId] = useState(place.tripId ?? "");
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  const [busy, setBusy] = useState(false);
  // Only a suggestion: the city this spot folds into changes when you pick it, never by itself.
  const nearestCity = useNearestCity();

  function setCoords(nextLat: string, nextLng: string) {
    setLat(nextLat);
    setLng(nextLng);
    // Nothing shows the suggestion for a city, so there's nothing to look up.
    if (isSpot) nearestCity.suggest(nextLat, nextLng);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus({});
    const spot = { lat: Number(lat), lng: Number(lng) };

    try {
      const result = await updatePlace({
        id: place.id,
        name,
        ...spot,
        countryCode,
        tripId: tripId || null,
        parent: isSpot ? parentInput(parent, spot) : null,
      });
      if (!result.ok) {
        setStatus({ error: result.error.message });
        return;
      }
      setStatus({ message: `Saved ${result.value.name}.` });
      router.refresh();
    } catch (error) {
      setStatus({ error: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="edit-name">Name</label>
        <input id="edit-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <CoordinateFields idPrefix="edit" lat={lat} lng={lng} countryCode={countryCode} onCoords={setCoords} onCountryCode={setCountryCode} />

      {isSpot && (
        <ParentCityField
          id="edit-parent"
          parent={parent}
          nearest={nearestCity.nearest}
          onChange={setParent}
          hint="Regroup this spot by naming another city. A name that isn’t on the map yet adds that city."
        />
      )}

      <div className="field">
        <label htmlFor="edit-trip">Trip</label>
        <select id="edit-trip" className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
          <option value="">No trip</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.name}
            </option>
          ))}
        </select>
      </div>

      <FormStatus {...status} />
      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
