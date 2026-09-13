"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { CityResult } from "@/app/api/cities/route";
import type { PlaceInput } from "@/lib/admin-commands";
import { formatDate } from "@/lib/format";
import type { Trip } from "@/lib/types";
import { addVisit, createPlace } from "./actions";
import { CitySearch } from "./CitySearch";
import { CoordinateFields } from "./CoordinateFields";
import { FormStatus } from "./FormStatus";
import { ParentCityField, noParent, parentInput, type Parent } from "./ParentCityField";
import { PhotoPicker, releasePreviews, uploadPhotos, type PendingPhoto } from "./photos";
import { useNearestCity } from "./useNearestCity";

type Kind = PlaceInput["kind"];

/** A city already on the map that the owner has just tried to add a second time. */
interface ExistingCity {
  id: string;
  name: string;
}

export function PlaceForm({ trips }: { trips: Trip[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("city");
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [parent, setParent] = useState<Parent>(noParent);
  const [tripId, setTripId] = useState("");
  const [visitedOn, setVisitedOn] = useState("");
  const [story, setStory] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  const [busy, setBusy] = useState(false);
  /** The city this turned out to be, when it's already on the map: the way through to a return visit. */
  const [existingCity, setExistingCity] = useState<ExistingCity | null>(null);
  // The nearest city only fills blanks, so nothing you've typed is overwritten.
  const nearestCity = useNearestCity((city) => {
    setCountryCode((code) => code || city.countryCode);
    setParent((current) => (current.name ? current : { name: city.name, lat: city.lat, lng: city.lng }));
  });

  function setCoords(nextLat: string, nextLng: string) {
    setLat(nextLat);
    setLng(nextLng);
    nearestCity.suggest(nextLat, nextLng);
  }

  function onPhotosAdded(added: PendingPhoto[]) {
    const located = added.find((p) => p.meta.lat !== null && p.meta.lng !== null);
    if (located && !lat && !lng) setCoords(String(located.meta.lat), String(located.meta.lng));
    const takenAt = added.find((p) => p.meta.takenAt)?.meta.takenAt;
    if (takenAt && !visitedOn) setVisitedOn(takenAt);
  }

  /** A different name may be a different city, so the refusal and the offer both go with the old one. */
  function rename(next: string) {
    setName(next);
    setExistingCity(null);
    setStatus({});
  }

  function pickCity(city: CityResult) {
    rename(city.name);
    setCountryCode(city.countryCode);
    setCoords(String(city.lat), String(city.lng));
  }

  function reset() {
    releasePreviews(photos);
    setExistingCity(null);
    setName("");
    setLat("");
    setLng("");
    setCountryCode("");
    setParent(noParent);
    nearestCity.clear();
    setVisitedOn("");
    setStory("");
    setPhotos([]);
  }

  /** Sends the photos picked here to a place that's now saved, and says how that went. */
  async function sendPhotos(placeId: string, done: string) {
    const failed = await uploadPhotos(placeId, photos, (i, total) => setStatus({ message: `Uploading photo ${i + 1} of ${total}…` }));
    setStatus(failed.length ? { error: `${done}, but some photos failed: ${failed.join(", ")}` } : { message: `${done}.` });
  }

  /** Records the date entered as a return visit to the city already on the map, photos and all. */
  async function addVisitToExisting(city: ExistingCity) {
    setBusy(true);
    setStatus({});
    try {
      const result = await addVisit({ placeId: city.id, date: visitedOn });
      if (!result.ok) {
        setStatus({ error: result.error.message });
        return;
      }
      // The photos picked for it belong to the city that's already there just the same.
      await sendPhotos(city.id, `Added a visit to ${city.name}`);
      reset();
      router.refresh();
    } catch (error) {
      setStatus({ error: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus({});
    setExistingCity(null);
    const spot = { lat: Number(lat), lng: Number(lng) };
    const input: PlaceInput = {
      kind,
      name,
      ...spot,
      countryCode,
      tripId: tripId || null,
      visitedOn: visitedOn || null,
      story,
      parent: kind === "poi" ? parentInput(parent, spot) : null,
    };

    try {
      const result = await createPlace(input);
      if (!result.ok) {
        // Somewhere you've already been isn't a mistake to correct: it's a return visit to offer.
        if (result.error.code === "city-already-exists") setExistingCity({ id: result.error.cityId, name });
        setStatus({ error: result.error.message });
        return;
      }
      await sendPhotos(result.value.id, `Saved ${name}`);
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
        <CitySearch id="place-city" label="City" value={name} onChange={rename} onPick={pickCity} required placeholder="Start typing: Cusco" />
      ) : (
        <div className="field">
          <label htmlFor="place-name">Name</label>
          <input id="place-name" className="input" value={name} onChange={(e) => rename(e.target.value)} required placeholder="Laguna 513" />
        </div>
      )}

      <CoordinateFields idPrefix="place" lat={lat} lng={lng} countryCode={countryCode} onCoords={setCoords} onCountryCode={setCountryCode} />

      {kind === "poi" && (
        <ParentCityField
          id="place-parent"
          parent={parent}
          nearest={nearestCity.nearest}
          onChange={setParent}
          hint="Filled with the nearest city. Change it if you think of this spot as part of somewhere else."
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

      {existingCity && (
        <>
          {/* Say what carries across, so nothing written here goes without the owner knowing. */}
          <p className="hint">
            {visitedOn
              ? `This records the date and any photos above on ${existingCity.name}. The story and trip above aren’t added to it.`
              : `Fill in the date you went back to record a return visit, or open ${existingCity.name} to edit it.`}
          </p>
          <div className="block-actions">
            {visitedOn ? (
              <button className="btn" type="button" disabled={busy} onClick={() => addVisitToExisting(existingCity)}>
                {busy ? "Adding…" : `Add a visit to ${existingCity.name} on ${formatDate(visitedOn)}`}
              </button>
            ) : (
              // Without a date there's no visit to record, so the way on is the city's own page.
              <Link className="btn" href={`/admin/places/${existingCity.id}`}>
                Open {existingCity.name}
              </Link>
            )}
          </div>
        </>
      )}

      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save place"}
        </button>
      </div>
    </form>
  );
}
