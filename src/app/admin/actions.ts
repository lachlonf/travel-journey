"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAdminCommands,
  type CommandResult,
  type PhotoCaptionInput,
  type PhotoRef,
  type PlaceInput,
  type PlaceUpdate,
  type StoryBlocksInput,
  type TripUpdate,
  type VisitInput,
} from "@/lib/admin-commands";
import { requireAdmin } from "@/lib/auth";
import { getRepository } from "@/lib/repository";
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_TTL_MS, sessionSecret } from "@/lib/session";
import type { Photo, Place, Trip } from "@/lib/types";

export interface FormState {
  error: string | null;
  message?: string;
}

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

const commands = () => createAdminCommands(getRepository());
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

// Every action below does the same four things: check the session, run one command, revalidate, return its result.

export async function createTrip(_state: unknown, formData: FormData): Promise<CommandResult<Trip>> {
  await requireAdmin();
  const result = await commands().createTrip({
    name: field(formData, "name"),
    story: field(formData, "story"),
    startDate: field(formData, "startDate") || null,
    endDate: field(formData, "endDate") || null,
  });
  if (result.ok) revalidateSite();
  return result;
}

export async function updateTrip(input: TripUpdate): Promise<CommandResult<Trip>> {
  await requireAdmin();
  const result = await commands().updateTrip(input);
  if (result.ok) revalidateSite();
  return result;
}

export async function deleteTrip(id: string): Promise<CommandResult<Trip>> {
  await requireAdmin();
  const result = await commands().deleteTrip(id);
  if (result.ok) revalidateSite();
  return result;
}

export async function createPlace(input: PlaceInput): Promise<CommandResult<Place>> {
  await requireAdmin();
  const result = await commands().addPlace(input);
  if (result.ok) revalidateSite();
  return result;
}

export async function updatePlace(input: PlaceUpdate): Promise<CommandResult<Place>> {
  await requireAdmin();
  const result = await commands().updatePlace(input);
  if (result.ok) revalidateSite();
  return result;
}

export async function deletePlace(id: string): Promise<CommandResult<Place>> {
  await requireAdmin();
  const result = await commands().deletePlace(id);
  if (result.ok) revalidateSite();
  return result;
}

export async function addVisit(input: VisitInput): Promise<CommandResult<Place>> {
  await requireAdmin();
  const result = await commands().addVisit(input);
  if (result.ok) revalidateSite();
  return result;
}

export async function removeVisit(input: VisitInput): Promise<CommandResult<Place>> {
  await requireAdmin();
  const result = await commands().removeVisit(input);
  if (result.ok) revalidateSite();
  return result;
}

export async function setStoryBlocks(input: StoryBlocksInput): Promise<CommandResult<Place>> {
  await requireAdmin();
  const result = await commands().setStoryBlocks(input);
  if (result.ok) revalidateSite();
  return result;
}

export async function updatePhotoCaption(input: PhotoCaptionInput): Promise<CommandResult<Photo>> {
  await requireAdmin();
  const result = await commands().updatePhotoCaption(input);
  if (result.ok) revalidateSite();
  return result;
}

export async function deletePhoto(input: PhotoRef): Promise<CommandResult<Photo>> {
  await requireAdmin();
  const result = await commands().deletePhoto(input);
  if (result.ok) revalidateSite();
  return result;
}

export async function addPhoto(formData: FormData): Promise<CommandResult<Photo>> {
  await requireAdmin();
  const file = formData.get("file");
  const result = await commands().addPhoto({
    placeId: field(formData, "placeId"),
    caption: field(formData, "caption"),
    takenAt: field(formData, "takenAt") || null,
    lat: Number(field(formData, "lat") || Number.NaN),
    lng: Number(field(formData, "lng") || Number.NaN),
    file: file instanceof File ? { bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type } : null,
  });
  if (result.ok) revalidateSite();
  return result;
}
