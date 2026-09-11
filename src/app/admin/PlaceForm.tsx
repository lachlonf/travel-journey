"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { CityResult } from "@/app/api/cities/route";
import { isValidLatLng } from "@/lib/geo";
import type { Trip } from "@/lib/types";
import { createPlace, type PlaceInput } from "./actions";
import { CitySearch } from "./CitySearch";
import { FormStatus } from "./FormStatus";
import { PhotoPicker, releasePreviews, uploadPhotos, type PendingPhoto } from "./photos";

type Kind = PlaceInput["kind"];

/** Coordinates are null for a custom name, which then sits at the spot itself. */
interface Parent {
  name: string;
  lat: number | null;
  lng: number | null;
}

const noParent: Parent = { name: "", lat: null, lng: null };

export function PlaceForm({ trips }: { trips: Trip[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("city");
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [parent, setParent] = useState<Parent>(noParent);
  const [nearest, setNearest] = useState<CityResult | null>(null);
  const [tripId, setTripId] = useState("");
  const [visitedOn, setVisitedOn] = useState("");
  const [story, setStory] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  const [busy, setBusy] = useState(false);
  const lookup = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Look up the nearest city. It only fills blanks, so nothing you've typed is overwritten. */
  function suggestNearest(latText: string, lngText: string) {
    clearTimeout(lookup.current);
    const [latitude, longitude] = [Number(latText), Number(lngText)];
    if (!latText.trim() || !lngText.trim() || !isValidLatLng(latitude, longitude)) return;

    lookup.current = setTimeout(async () => {
      const response = await fetch(`/api/cities?lat=${latitude}&lng=${longitude}`);
      if (!response.ok) return;
      const { nearest: city } = (await response.json()) as { nearest: CityResult | null };
      if (!city) return;
      setNearest(city);
      setCountryCode((code) => code || city.countryCode);
      setParent((current) => (current.name ? current : { name: city.name, lat: city.lat, lng: city.lng }));
    }, 350);
  }

  function setCoords(nextLat: string, nextLng: string) {
    setLat(nextLat);
    setLng(nextLng);
    suggestNearest(nextLat, nextLng);
  }

  function onPhotosAdded(added: PendingPhoto[]) {
    const located = added.find((p) => p.meta.lat !== null && p.meta.lng !== null);
    if (located && !lat && !lng) setCoords(String(located.meta.lat), String(located.meta.lng));
    const takenAt = added.find((p) => p.meta.takenAt)?.meta.takenAt;
    if (takenAt && !visitedOn) setVisitedOn(takenAt);
  }

  function pickCity(city: CityResult) {
    setName(city.name);
    setCountryCode(city.countryCode);
    setCoords(String(city.lat), String(city.lng));
  }

  function reset() {
    releasePreviews(photos);
    setName("");
    setLat("");
    setLng("");
    setCountryCode("");
    setParent(noParent);
    setNearest(null);
    setVisitedOn("");
    setStory("");
    setPhotos([]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus({});
    const spot = { lat: Number(lat), lng: Number(lng) };
    const input: PlaceInput = {
      kind,
      name,
      ...spot,
      countryCode,
      tripId: tripId || null,
      visitedOn: visitedOn || null,
      story,
      parent: kind === "poi" ? { name: parent.name, lat: parent.lat ?? spot.lat, lng: parent.lng ?? spot.lng } : null,
    };

    try {
      const result = await createPlace(input);
      if ("error" in result) {
        setStatus({ error: result.error });
        return;
      }
      const failed = await uploadPhotos(result.placeId, photos, (i, total) =>
        setStatus({ message: `Uploading photo ${i + 1} of ${total}…` }),
      );
      setStatus(failed.length ? { error: `Saved ${name}, but some photos failed: ${failed.join(", ")}` } : { message: `Saved ${name}.` });
      reset();
      router.refresh();
    } catch (error) {
      setStatus({ error: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <fieldset className="segmented">
        <legend className="sr-only">Kind of place</legend>
        {(["city", "poi"] as const).map((k) => (
          <label key={k}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
            {k === "city" ? "City" : "Specific spot"}
          </label>
        ))}
      </fieldset>
      <p className="hint">
        {kind === "city"
          ? "A city or town. It gets its own pin and can hold photos."
          : "A lake, a trailhead, a viewpoint. From the country view it folds into its city’s pin."}
      </p>

      <PhotoPicker
        id="place-photos"
        label="Photos (optional; their location and date fill in the fields below)"
        photos={photos}
        onChange={setPhotos}
        onAdded={onPhotosAdded}
      />

      {kind === "city" ? (
        <CitySearch id="place-city" label="City" value={name} onChange={setName} onPick={pickCity} required placeholder="Start typing: Cusco" />
      ) : (
        <div className="field">
          <label htmlFor="place-name">Name</label>
          <input id="place-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Laguna 513" />
        </div>
      )}

      <div className="form-row">
        <div className="field">
          <label htmlFor="place-lat">Latitude</label>
          <input id="place-lat" className="input" inputMode="decimal" value={lat} onChange={(e) => setCoords(e.target.value, lng)} required placeholder="-9.2112" />
        </div>
        <div className="field">
          <label htmlFor="place-lng">Longitude</label>
          <input id="place-lng" className="input" inputMode="decimal" value={lng} onChange={(e) => setCoords(lat, e.target.value)} required placeholder="-77.5466" />
        </div>
        <div className="field">
          <label htmlFor="place-country">Country code</label>
          <input
            id="place-country"
            className="input"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
            required
            maxLength={2}
            pattern="[A-Za-z]{2}"
            placeholder="PE"
          />
        </div>
      </div>

      {kind === "poi" && (
        <CitySearch
          id="place-parent"
          label="Folds into city"
          value={parent.name}
          onChange={(text) => setParent({ name: text, lat: null, lng: null })}
          onPick={(city) => setParent({ name: city.name, lat: city.lat, lng: city.lng })}
          required
          hint={
            nearest && parent.name !== nearest.name ? (
              <>
                Nearest in the database:{" "}
                <button type="button" onClick={() => setParent({ name: nearest.name, lat: nearest.lat, lng: nearest.lng })}>
                  {nearest.name}
                </button>
              </>
            ) : (
              "Filled with the nearest city. Change it if you think of this spot as part of somewhere else."
            )
          }
        />
      )}

      <div className="form-row">
        <div className="field">
          <label htmlFor="place-trip">Trip</label>
          <select id="place-trip" className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
            <option value="">No trip</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="place-date">Visited</label>
          <input id="place-date" type="date" className="input" value={visitedOn} onChange={(e) => setVisitedOn(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="place-story">Story</label>
        <textarea
          id="place-story"
          className="input"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="Write it how you’d tell it. Blank lines start new paragraphs."
        />
      </div>

      <FormStatus {...status} />
      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save place"}
        </button>
      </div>
    </form>
  );
}
