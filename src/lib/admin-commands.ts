import { isValidLatLng } from "./geo";
import { findCityPlace } from "./journey";
import { isAllowedImageType, type JourneyRepository, type NewTrip, type UploadedFile } from "./repository/types";
import type { JourneyData, Photo, Place, PlaceKind, StoryBlock, Trip } from "./types";

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
  | { code: "city-still-has-spots"; message: string }
  | { code: "invalid-story"; message: string }
  | { code: "photo-not-in-this-place"; message: string }
  | { code: "duplicate-photo"; message: string }
  | { code: "unsupported-file-type"; message: string };

export type CommandResult<T> = { ok: true; value: T } | { ok: false; error: CommandError };

export interface TripInput {
  name: string;
  story: string;
  startDate: string | null;
  endDate: string | null;
}

/** A trip as the owner refines it: the same fields as creating one, on a trip that already exists. */
export interface TripUpdate extends TripInput {
  id: string;
}

/** What a place is called and where it sits: the same fields whether you're adding one or correcting one. */
export interface PlaceDetails {
  name: string;
  lat: number;
  lng: number;
  countryCode: string;
  tripId: string | null;
}

export interface PlaceInput extends PlaceDetails {
  kind: PlaceKind;
  visitedOn: string | null;
  story: string;
  /** For specific spots: the city it folds into. Matched to an existing city by name, otherwise created. */
  parent: { name: string; lat: number; lng: number } | null;
}

/** A place's details as the owner corrects them. Its kind, visits and story are changed elsewhere. */
export interface PlaceUpdate extends PlaceDetails {
  id: string;
  /** For specific spots: the city it folds into, found or created as when adding. Ignored for cities. */
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

/** Which photo the owner means: always one of a place's own photos, never a photo id on its own. */
export interface PhotoRef {
  placeId: string;
  photoId: string;
}

export interface PhotoCaptionInput extends PhotoRef {
  caption: string;
}

export interface StoryBlocksInput {
  placeId: string;
  /** The whole story in reading order. A photo no block mentions isn't deleted: it waits at the end. */
  blocks: StoryBlock[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const ok = <T>(value: T): CommandResult<T> => ({ ok: true, value });
const fail = <T>(error: CommandError): CommandResult<T> => ({ ok: false, error });
const text = (value: unknown) => String(value ?? "").trim();

/** What creating and refining a trip both check, and the trip they agree on. */
function validatedTrip(input: TripInput): CommandResult<NewTrip> {
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

  return ok({ name, story: text(input.story), startDate, endDate });
}

/** What adding and editing a place both check. */
function placeDetailsError(data: JourneyData, place: PlaceDetails): CommandError | null {
  if (!place.name) return { code: "name-required", message: "The place needs a name." };
  if (!isValidLatLng(place.lat, place.lng)) return { code: "invalid-coordinates", message: "Those coordinates aren't on Earth." };
  if (!/^[A-Z]{2}$/.test(place.countryCode)) return { code: "invalid-country", message: "Country must be a two-letter code, like PE." };
  if (place.tripId && !data.trips.some((t) => t.id === place.tripId)) return { code: "unknown-trip", message: "That trip doesn't exist." };
  return null;
}

type ParentCity = NonNullable<PlaceInput["parent"]>;

/** The parent as given, or null when it has no name or its coordinates aren't on Earth. */
function validParent(parent: PlaceInput["parent"]): ParentCity | null {
  const name = text(parent?.name);
  return parent && name && isValidLatLng(parent.lat, parent.lng) ? { name, lat: parent.lat, lng: parent.lng } : null;
}

/**
 * Every write to the journal. Validates input and returns a typed error for anything the owner can fix;
 * throws only when something unexpected breaks, like the store.
 */
export function createAdminCommands(repository: JourneyRepository) {
  /** The city a spot folds into: matched by name within the country, otherwise created. */
  async function parentCityId(places: readonly Place[], parent: ParentCity, countryCode: string): Promise<string> {
    const existing = findCityPlace(places, parent.name, countryCode);
    if (existing) return existing.id;
    const created = await repository.createPlace({
      kind: "city",
      name: parent.name,
      lat: parent.lat,
      lng: parent.lng,
      countryCode,
      parentId: null,
      // Just the grouping the spot folds into, not a stop you chose: no trip, no visit.
      tripId: null,
      visitedOn: [],
      storyBlocks: [],
    });
    return created.id;
  }

  /**
   * The photo the owner means, with the place it belongs to. A photo is only ever reached
   * through its place, so a photo id from elsewhere can't be edited or deleted.
   */
  async function ownPhoto(input: PhotoRef): Promise<CommandResult<{ place: Place; photo: Photo }>> {
    // Server actions take any payload, so this may not even be an object.
    const data = await repository.load();
    const place = input && typeof input === "object" ? data.places.find((p) => p.id === input.placeId) : undefined;
    if (!place) return fail({ code: "unknown-place", message: "That place doesn't exist." });

    const photoId = text(input.photoId);
    const photo = data.photos.find((p) => p.id === photoId && p.placeId === place.id);
    if (!photo) return fail({ code: "photo-not-in-this-place", message: "That photo isn't one of this place's photos." });
    return ok({ place, photo });
  }

  return {
    async createTrip(input: TripInput): Promise<CommandResult<Trip>> {
      const fields = validatedTrip(input);
      return fields.ok ? ok(await repository.createTrip(fields.value)) : fields;
    },

    async updateTrip(input: TripUpdate): Promise<CommandResult<Trip>> {
      // Server actions take any payload, so an edit may not even be an object.
      const data = await repository.load();
      const trip = input && typeof input === "object" ? data.trips.find((t) => t.id === input.id) : undefined;
      if (!trip) return fail({ code: "unknown-trip", message: "That trip doesn't exist." });

      const fields = validatedTrip(input);
      return fields.ok ? ok(await repository.updateTrip(trip.id, fields.value)) : fields;
    },

    /** Dissolves the grouping: the trip goes and its places stay, simply no longer on a trip. */
    async deleteTrip(id: string): Promise<CommandResult<Trip>> {
      const data = await repository.load();
      const trip = data.trips.find((t) => t.id === id);
      if (!trip) return fail({ code: "unknown-trip", message: "That trip doesn't exist." });

      await repository.deleteTrip(trip.id);
      return ok(trip);
    },

    async addPlace(input: PlaceInput): Promise<CommandResult<Place>> {
      // Server actions take any payload, so a place may not even be an object.
      if (!input || typeof input !== "object") return fail({ code: "invalid-kind", message: "Choose city or specific spot." });

      const data = await repository.load();
      const name = text(input.name);
      const countryCode = text(input.countryCode).toUpperCase();
      const tripId = input.tripId || null;

      if (input.kind !== "city" && input.kind !== "poi") return fail({ code: "invalid-kind", message: "Choose city or specific spot." });
      const invalid = placeDetailsError(data, { name, lat: input.lat, lng: input.lng, countryCode, tripId });
      if (invalid) return fail(invalid);
      if (input.visitedOn && !ISO_DATE.test(input.visitedOn)) return fail({ code: "invalid-date", message: "Visit date must be YYYY-MM-DD." });

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
        const parent = validParent(input.parent);
        if (!parent) return fail({ code: "parent-city-required", message: "A specific spot needs a city to fold into." });
        parentId = await parentCityId(data.places, parent, countryCode);
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

    async updatePlace(input: PlaceUpdate): Promise<CommandResult<Place>> {
      const data = await repository.load();
      const place = input && typeof input === "object" ? data.places.find((p) => p.id === input.id) : undefined;
      if (!place) return fail({ code: "unknown-place", message: "That place doesn't exist." });

      const details: PlaceDetails = {
        name: text(input.name),
        lat: input.lat,
        lng: input.lng,
        countryCode: text(input.countryCode).toUpperCase(),
        tripId: input.tripId || null,
      };
      const invalid = placeDetailsError(data, details);
      if (invalid) return fail(invalid);

      if (place.kind === "city") {
        const existing = findCityPlace(data.places, details.name, details.countryCode);
        if (existing && existing.id !== place.id) {
          return fail({ code: "city-already-exists", message: `${details.name} is already on the map.`, cityId: existing.id });
        }
        return ok(await repository.updatePlace(place.id, details));
      }

      // Every check comes before this: resolving the parent may create a city.
      const parent = validParent(input.parent);
      if (!parent) return fail({ code: "parent-city-required", message: "A specific spot needs a city to fold into." });

      // Keeping the same city keeps the very same city, so correcting a spot's country doesn't
      // tear it out of the city it folds into and leave a copy behind in the new country.
      const current = data.places.find((p) => p.id === place.parentId);
      const unchanged = current?.name.toLowerCase() === parent.name.toLowerCase();
      const parentId = current && unchanged ? current.id : await parentCityId(data.places, parent, details.countryCode);
      return ok(await repository.updatePlace(place.id, { ...details, parentId }));
    },

    /**
     * Removes the place for good, with its photos and their stored files. A city that still has
     * spots is refused: one click shouldn't wipe out several places, and the spots would be orphaned.
     * A country whose last place goes locks back into ASCII on its own, since the globe reads the places.
     */
    async deletePlace(id: string): Promise<CommandResult<Place>> {
      const data = await repository.load();
      const place = data.places.find((p) => p.id === id);
      if (!place) return fail({ code: "unknown-place", message: "That place doesn't exist." });

      const spots = data.places.filter((p) => p.parentId === place.id);
      if (spots.length) {
        return fail({
          code: "city-still-has-spots",
          message: `${place.name} still has ${spots.length === 1 ? "a spot" : `${spots.length} spots`} folded into it. Delete ${spots.length === 1 ? "it" : "them"} first.`,
        });
      }

      await repository.deletePlace(place.id);
      return ok(place);
    },

    /** Arranges a place's story. Replaces every block, so what isn't given is no longer in the story. */
    async setStoryBlocks(input: StoryBlocksInput): Promise<CommandResult<Place>> {
      // Server actions take any payload, so an arrangement may not even be an object.
      const data = await repository.load();
      const place = input && typeof input === "object" ? data.places.find((p) => p.id === input.placeId) : undefined;
      if (!place) return fail({ code: "unknown-place", message: "That place doesn't exist." });

      const notAStory: CommandError = { code: "invalid-story", message: "A story is a list of text passages and photos." };
      if (!Array.isArray(input.blocks)) return fail(notAStory);

      const ours = new Set(data.photos.filter((p) => p.placeId === place.id).map((p) => p.id));
      const used = new Set<string>();
      const blocks: StoryBlock[] = [];

      // Nothing is written until every block checks out, so a refused arrangement leaves the story as it was.
      for (const block of input.blocks) {
        if (block?.type === "text") {
          // A passage that's only whitespace would leave a gap in the story, so it goes.
          const passage = text(block.text);
          if (passage) blocks.push({ type: "text", text: passage });
          continue;
        }
        if (block?.type !== "photo") return fail(notAStory);

        const photoId = text(block.photoId);
        if (!ours.has(photoId)) return fail({ code: "photo-not-in-this-place", message: "That photo isn't one of this place's photos." });
        if (used.has(photoId)) return fail({ code: "duplicate-photo", message: "That photo is already in this story." });
        used.add(photoId);
        blocks.push({ type: "photo", photoId });
      }

      return ok(await repository.updatePlace(place.id, { storyBlocks: blocks }));
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

    /** Says something new about a photo. Where it sits in the story doesn't change. */
    async updatePhotoCaption(input: PhotoCaptionInput): Promise<CommandResult<Photo>> {
      const found = await ownPhoto(input);
      if (!found.ok) return found;
      return ok(await repository.updatePhoto(found.value.photo.id, { caption: text(input.caption) }));
    },

    /** Removes the photo for good: its place in the story, its record, and its stored file. */
    async deletePhoto(input: PhotoRef): Promise<CommandResult<Photo>> {
      const found = await ownPhoto(input);
      if (!found.ok) return found;
      const { place, photo } = found.value;

      // The block goes first, so the story never points at a photo whose file has already gone.
      const blocks = place.storyBlocks.filter((b) => b.type !== "photo" || b.photoId !== photo.id);
      if (blocks.length !== place.storyBlocks.length) await repository.updatePlace(place.id, { storyBlocks: blocks });
      await repository.deletePhoto(photo.id);
      return ok(photo);
    },
  };
}
