"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { CityResult } from "@/app/api/cities/route";
import type { PlaceInput } from "@/lib/admin-commands";
import { formatDate, plural } from "@/lib/format";
import type { Trip } from "@/lib/types";
import { addVisit, createPlace } from "./actions";
import { CitySearch } from "./CitySearch";
import { CoordinateFields } from "./CoordinateFields";
import { FormStatus } from "./FormStatus";
import { ParentCityField, noParent, parentInput, type Parent } from "./ParentCityField";
import { countFailed, PhotoPicker, releasePreviews, uploadPhotos, type PendingPhoto } from "./photos";
import { useNearestCity } from "./useNearestCity";

type Kind = PlaceInput["kind"];

/** A city already on the map that the owner has just tried to add a second time. */
interface ExistingCity {
  id: string;
  name: string;
}

/** A place that's saved with photos still to go up: what a retry sends them to, so it isn't added twice. */
interface AwaitingPhotos {
  placeId: string;
  done: string;
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
  const [awaiting, setAwaiting] = useState<AwaitingPhotos | null>(null);
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
    setAwaiting(null);
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

  /**
   * Sends the photos picked here to a place that's now saved, and says how that went. Photos already
   * up are skipped, so this is the retry too. Returns how many are still to go.
   */
  async function sendPhotos(placeId: string, done: string): Promise<number> {
    const failed = await uploadPhotos(placeId, photos, setPhotos);
    setStatus(failed ? { error: `${done}, but ${plural(failed, "photo")} didn’t go up.` } : { message: `${done}.` });
    return failed;
  }

  /** What both saving and retrying do afterwards: a clean slate only once every photo has landed. */
  function settle(placeId: string, done: string, failed: number) {
    router.refresh();
    if (failed) setAwaiting({ placeId, done });
    else reset();
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
      const done = `Added a visit to ${city.name}`;
      settle(city.id, done, await sendPhotos(city.id, done));
    } catch (error) {
      setStatus({ error: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  /** Sends again the photos that didn't make it, to the place that's already saved. */
  async function retryPhotos({ placeId, done }: AwaitingPhotos) {
    setBusy(true);
    setStatus({});
    try {
      settle(placeId, done, await sendPhotos(placeId, done));
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
    const coords = { lat: Number(lat), lng: Number(lng) };
    const input: PlaceInput = {
      kind,
      name,
      ...coords,
      countryCode,
      tripId: tripId || null,
      visitedOn: visitedOn || null,
      story,
      parent: kind === "spot" ? parentInput(parent, coords) : null,
    };

    try {
      const result = await createPlace(input);
      if (!result.ok) {
        // Somewhere you've already been isn't a mistake to correct: it's a return visit to offer.
        if (result.error.code === "city-already-exists") setExistingCity({ id: result.error.cityId, name });
        setStatus({ error: result.error.message });
        return;
      }
      const done = `Saved ${name}`;
      settle(result.value.id, done, await sendPhotos(result.value.id, done));
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
        {(["city", "spot"] as const).map((k) => (
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
        busy={busy}
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

      {kind === "spot" && (
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

      {awaiting ? (
        <>
          {/* The place is saved, so the way on is the photos, not this form again. */}
          <p className="hint">
            The place is saved and the fields above no longer change it. The photos marked above haven’t gone up yet, captions and all. Starting
            another place leaves them behind.
          </p>
          <div className="block-actions">
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => retryPhotos(awaiting)}>
              {busy ? "Uploading…" : `Retry ${plural(countFailed(photos), "photo")}`}
            </button>
            <button className="btn" type="button" disabled={busy} onClick={reset}>
              Start another place
            </button>
          </div>
        </>
      ) : (
        <div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save place"}
          </button>
        </div>
      )}
    </form>
  );
}
