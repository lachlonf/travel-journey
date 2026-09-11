import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Photo, Place, Trip } from "../types";
import { extensionFor, type JourneyRepository } from "./types";

export const PHOTO_BUCKET = "photos";

// Rows are snake_case in Postgres; the app is camelCase.
interface TripRow {
  id: string;
  name: string;
  story: string;
  start_date: string | null;
  end_date: string | null;
}

interface PlaceRow {
  id: string;
  kind: Place["kind"];
  name: string;
  lat: number;
  lng: number;
  country_code: string;
  parent_id: string | null;
  trip_id: string | null;
  visited_on: string[];
  story: string;
}

interface PhotoRow {
  id: string;
  place_id: string;
  storage_path: string;
  caption: string;
  taken_at: string | null;
  lat: number | null;
  lng: number | null;
  sort_order: number;
}

const tripFromRow = (r: TripRow): Trip => ({
  id: r.id,
  name: r.name,
  story: r.story,
  startDate: r.start_date,
  endDate: r.end_date,
});

const placeFromRow = (r: PlaceRow): Place => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  lat: r.lat,
  lng: r.lng,
  countryCode: r.country_code,
  parentId: r.parent_id,
  tripId: r.trip_id,
  visitedOn: r.visited_on,
  story: r.story,
});

function unwrap<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** Server-only: uses the service role key, so it must never reach the browser. */
export function createSupabaseRepository(url: string, serviceRoleKey: string): JourneyRepository {
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const photoFromRow = (r: PhotoRow): Photo => ({
    id: r.id,
    placeId: r.place_id,
    url: client.storage.from(PHOTO_BUCKET).getPublicUrl(r.storage_path).data.publicUrl,
    caption: r.caption,
    takenAt: r.taken_at,
    lat: r.lat,
    lng: r.lng,
    sortOrder: r.sort_order,
  });

  return {
    async load() {
      const [trips, places, photos] = await Promise.all([
        client.from("trips").select("*").order("created_at"),
        client.from("places").select("*").order("created_at"),
        client.from("photos").select("*").order("created_at"),
      ]);
      return {
        trips: unwrap<TripRow[]>(trips).map(tripFromRow),
        places: unwrap<PlaceRow[]>(places).map(placeFromRow),
        photos: unwrap<PhotoRow[]>(photos).map(photoFromRow),
      };
    },

    async createTrip(input) {
      const row = { name: input.name, story: input.story, start_date: input.startDate, end_date: input.endDate };
      return tripFromRow(unwrap<TripRow>(await client.from("trips").insert(row).select().single()));
    },

    async createPlace(input) {
      const row = {
        kind: input.kind,
        name: input.name,
        lat: input.lat,
        lng: input.lng,
        country_code: input.countryCode,
        parent_id: input.parentId,
        trip_id: input.tripId,
        visited_on: input.visitedOn,
        story: input.story,
      };
      return placeFromRow(unwrap<PlaceRow>(await client.from("places").insert(row).select().single()));
    },

    async addPhoto(input, file) {
      const path = `${input.placeId}/${randomUUID()}.${extensionFor(file.contentType)}`;
      const upload = await client.storage.from(PHOTO_BUCKET).upload(path, file.bytes, { contentType: file.contentType });
      if (upload.error) throw new Error(upload.error.message);

      const row = {
        place_id: input.placeId,
        storage_path: path,
        caption: input.caption,
        taken_at: input.takenAt,
        lat: input.lat,
        lng: input.lng,
        sort_order: input.sortOrder,
      };
      return photoFromRow(unwrap<PhotoRow>(await client.from("photos").insert(row).select().single()));
    },
  };
}
