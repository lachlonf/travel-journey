import { isValidLatLng } from "./geo";
import { findCityPlace } from "./journey";
import { isAllowedImageType, type JourneyRepository, type UploadedFile } from "./repository/types";
import type { Photo, Place, PlaceKind, Trip } from "./types";

/** A refusal the owner can act on. Codes are stable; messages are for people. */
export type CommandError =
  | { code: "name-required"; message: string }
  | { code: "invalid-kind"; message: string }
  | { code: "invalid-coordinates"; message: string }
  | { code: "invalid-country"; message: string }
  | { code: "invalid-date"; message: string }
  | { code: "parent-city-required"; message: string }
  | { code: "unknown-place"; message: string }
  | { code: "unknown-trip"; message: string }
  | { code: "city-already-exists"; message: string; cityId: string }
  | { code: "unsupported-file-type"; message: string };

export type CommandResult<T> = { ok: true; value: T } | { ok: false; error: CommandError };

export interface TripInput {
  name: string;
  story: string;
  startDate: string | null;
  endDate: string | null;
}

export interface PlaceInput {
  kind: PlaceKind;
  name: string;
  lat: number;
  lng: number;
  countryCode: string;
  tripId: string | null;
  visitedOn: string | null;
  story: string;
  /** For specific spots: the city it folds into. Matched to an existing city by name, otherwise created. */
  parent: { name: string; lat: number; lng: number } | null;
}

export interface PhotoInput {
  placeId: string;
  caption: string;
  takenAt: string | null;
  /** Where it was taken, if the photo says. Coordinates that aren't on Earth are dropped. */
  lat: number | null;
  lng: number | null;
  /** Null when no file came with the request. */
  file: UploadedFile | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const ok = <T>(value: T): CommandResult<T> => ({ ok: true, value });
const fail = <T>(error: CommandError): CommandResult<T> => ({ ok: false, error });
const text = (value: unknown) => String(value ?? "").trim();

/**
 * Every write to the journal. Validates input and returns a typed error for anything the owner can fix;
 * throws only when something unexpected breaks, like the store.
 */
export function createAdminCommands(repository: JourneyRepository) {
  return {
    async createTrip(input: TripInput): Promise<CommandResult<Trip>> {
      const name = text(input.name);
      const startDate = text(input.startDate) || null;
      const endDate = text(input.endDate) || null;

      if (!name) return fail({ code: "name-required", message: "A trip needs a name." });
      if ([startDate, endDate].some((d) => d !== null && !ISO_DATE.test(d))) {
        return fail({ code: "invalid-date", message: "Dates must be YYYY-MM-DD." });
      }
      if (startDate && endDate && endDate < startDate) {
        return fail({ code: "invalid-date", message: "The trip ends before it starts." });
      }

      return ok(await repository.createTrip({ name, story: text(input.story), startDate, endDate }));
    },

    async addPlace(input: PlaceInput): Promise<CommandResult<Place>> {
      // Server actions take any payload, so a place may not even be an object.
      if (!input || typeof input !== "object") return fail({ code: "invalid-kind", message: "Choose city or specific spot." });

      const data = await repository.load();
      const name = text(input.name);
      const countryCode = text(input.countryCode).toUpperCase();
      const tripId = input.tripId || null;

      if (input.kind !== "city" && input.kind !== "poi") return fail({ code: "invalid-kind", message: "Choose city or specific spot." });
      if (!name) return fail({ code: "name-required", message: "The place needs a name." });
      if (!isValidLatLng(input.lat, input.lng)) return fail({ code: "invalid-coordinates", message: "Those coordinates aren't on Earth." });
      if (!/^[A-Z]{2}$/.test(countryCode)) return fail({ code: "invalid-country", message: "Country must be a two-letter code, like PE." });
      if (input.visitedOn && !ISO_DATE.test(input.visitedOn)) return fail({ code: "invalid-date", message: "Visit date must be YYYY-MM-DD." });
      if (tripId && !data.trips.some((t) => t.id === tripId)) return fail({ code: "unknown-trip", message: "That trip doesn't exist." });

      const existing = input.kind === "city" ? findCityPlace(data.places, name, countryCode) : undefined;
      if (existing) {
        return fail({
          code: "city-already-exists",
          message: `${name} is already on the map. Add photos to it below instead.`,
          cityId: existing.id,
        });
      }

      let parentId: string | null = null;
      if (input.kind === "poi") {
        const parentName = text(input.parent?.name);
        if (!input.parent || !parentName || !isValidLatLng(input.parent.lat, input.parent.lng)) {
          return fail({ code: "parent-city-required", message: "A specific spot needs a city to fold into." });
        }
        parentId =
          findCityPlace(data.places, parentName, countryCode)?.id ??
          (
            await repository.createPlace({
              kind: "city",
              name: parentName,
              lat: input.parent.lat,
              lng: input.parent.lng,
              countryCode,
              parentId: null,
              // Just the grouping the spot folds into, not a stop you chose: no trip, no visit.
              tripId: null,
              visitedOn: [],
              storyBlocks: [],
            })
          ).id;
      }

      const story = String(input.story ?? "");
      return ok(
        await repository.createPlace({
          kind: input.kind,
          name,
          lat: input.lat,
          lng: input.lng,
          countryCode,
          parentId,
          tripId,
          visitedOn: input.visitedOn ? [input.visitedOn] : [],
          storyBlocks: story.trim() ? [{ type: "text", text: story }] : [],
        }),
      );
    },

    async addPhoto(input: PhotoInput): Promise<CommandResult<Photo>> {
      const { file } = input;
      const takenAt = text(input.takenAt) || null;

      if (!file || !isAllowedImageType(file.contentType)) {
        return fail({ code: "unsupported-file-type", message: "Only JPEG, PNG, WebP, AVIF or HEIC images." });
      }
      if (takenAt && !ISO_DATE.test(takenAt)) return fail({ code: "invalid-date", message: "Photo date must be YYYY-MM-DD." });

      const data = await repository.load();
      if (!data.places.some((p) => p.id === input.placeId)) return fail({ code: "unknown-place", message: "That place doesn't exist." });

      // No block for it yet: the read model appends photos no block references, so it lands at the end of the story.
      const located = isValidLatLng(input.lat, input.lng);
      return ok(
        await repository.addPhoto(
          {
            placeId: input.placeId,
            caption: text(input.caption),
            takenAt,
            lat: located ? input.lat : null,
            lng: located ? input.lng : null,
          },
          file,
        ),
      );
    },
  };
}
