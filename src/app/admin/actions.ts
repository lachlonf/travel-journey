"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin, sessionSecret } from "@/lib/auth";
import { findCityPlace } from "@/lib/journey";
import { getRepository } from "@/lib/repository";
import { isAllowedImageType } from "@/lib/repository/types";
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session";
import type { PlaceKind } from "@/lib/types";

export interface FormState {
  error: string | null;
  message?: string;
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
  /** For POIs: the city it folds into. Matched to an existing city by name, otherwise created. */
  parent: { name: string; lat: number; lng: number } | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const field = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const isLatLng = (lat: unknown, lng: unknown) =>
  typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const revalidateSite = () => revalidatePath("/", "layout");

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = sessionSecret();
  if (!password || secret.length < 32) {
    return { error: "Admin isn't set up: set ADMIN_PASSWORD and a SESSION_SECRET of at least 32 characters." };
  }
  if (!(await passwordMatches(String(formData.get("password") ?? ""), password))) {
    // A small delay makes guessing slower; there's no lockout yet.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: "That's not it." };
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

export async function createTrip(_state: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = field(formData, "name");
  const startDate = field(formData, "startDate") || null;
  const endDate = field(formData, "endDate") || null;

  if (!name) return { error: "A trip needs a name." };
  if ([startDate, endDate].some((d) => d !== null && !ISO_DATE.test(d))) return { error: "Dates must be YYYY-MM-DD." };
  if (startDate && endDate && endDate < startDate) return { error: "The trip ends before it starts." };

  await getRepository().createTrip({ name, story: field(formData, "story"), startDate, endDate });
  revalidateSite();
  return { error: null, message: `Added “${name}”.` };
}

export async function createPlace(input: PlaceInput): Promise<{ error: string } | { placeId: string }> {
  await requireAdmin();
  if (!input || typeof input !== "object") return { error: "Nothing to save." };

  const repository = getRepository();
  const data = await repository.load();
  const name = String(input.name ?? "").trim();
  const countryCode = String(input.countryCode ?? "").trim().toUpperCase();
  const tripId = input.tripId || null;
  const visitedOn = input.visitedOn ? [input.visitedOn] : [];

  if (input.kind !== "city" && input.kind !== "poi") return { error: "Choose city or specific spot." };
  if (!name) return { error: "The place needs a name." };
  if (!isLatLng(input.lat, input.lng)) return { error: "Those coordinates aren't on Earth." };
  if (!/^[A-Z]{2}$/.test(countryCode)) return { error: "Country must be a two-letter code, like PE." };
  if (input.visitedOn && !ISO_DATE.test(input.visitedOn)) return { error: "Visit date must be YYYY-MM-DD." };
  if (tripId && !data.trips.some((t) => t.id === tripId)) return { error: "That trip doesn't exist." };
  if (input.kind === "city" && findCityPlace(data.places, name, countryCode)) {
    return { error: `${name} is already on the map. Add photos to it below instead.` };
  }

  let parentId: string | null = null;
  if (input.kind === "poi") {
    const parentName = String(input.parent?.name ?? "").trim();
    if (!input.parent || !parentName || !isLatLng(input.parent.lat, input.parent.lng)) {
      return { error: "A specific spot needs a city to fold into." };
    }
    const existing = findCityPlace(data.places, parentName, countryCode);
    parentId =
      existing?.id ??
      (
        await repository.createPlace({
          kind: "city",
          name: parentName,
          lat: input.parent.lat,
          lng: input.parent.lng,
          countryCode,
          parentId: null,
          tripId,
          visitedOn,
          story: "",
        })
      ).id;
  }

  const place = await repository.createPlace({
    kind: input.kind,
    name,
    lat: input.lat,
    lng: input.lng,
    countryCode,
    parentId,
    tripId,
    visitedOn,
    story: String(input.story ?? ""),
  });
  revalidateSite();
  return { placeId: place.id };
}

export async function addPhoto(formData: FormData): Promise<{ error: string } | { photoId: string }> {
  await requireAdmin();
  const file = formData.get("file");
  const placeId = field(formData, "placeId");
  const takenAt = field(formData, "takenAt") || null;
  const lat = Number(field(formData, "lat") || Number.NaN);
  const lng = Number(field(formData, "lng") || Number.NaN);

  if (!(file instanceof File) || !isAllowedImageType(file.type)) return { error: "Only JPEG, PNG, WebP, AVIF or HEIC images." };
  if (takenAt && !ISO_DATE.test(takenAt)) return { error: "Photo date must be YYYY-MM-DD." };

  const repository = getRepository();
  const data = await repository.load();
  if (!data.places.some((p) => p.id === placeId)) return { error: "That place doesn't exist." };

  const photo = await repository.addPhoto(
    {
      placeId,
      caption: field(formData, "caption"),
      takenAt,
      ...(isLatLng(lat, lng) ? { lat, lng } : { lat: null, lng: null }),
      sortOrder: data.photos.filter((p) => p.placeId === placeId).length,
    },
    { bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type },
  );
  revalidateSite();
  return { photoId: photo.id };
}
