import { join } from "node:path";
import { createLocalRepository, type LocalRepositoryOptions } from "./local";
import { createSupabaseRepository } from "./supabase";
import type { JourneyRepository } from "./types";

let repository: JourneyRepository | undefined;

/**
 * The local store's settings when the app is running on it, and null when it's on Supabase.
 * The dev-only upload endpoint asks first, so it isn't served against Supabase.
 */
export function getLocalOptions(): LocalRepositoryOptions | null {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) return null;

  const root = process.cwd();
  return {
    dataFile: join(root, ".data", "journey.json"),
    seedFile: join(root, "data", "seed.json"),
    uploadsDir: join(root, "public", "uploads"),
    publicUrlPrefix: "/uploads",
  };
}

/** Supabase when it's configured, otherwise a JSON file under .data/ for local development. */
export function getRepository(): JourneyRepository {
  if (repository) return repository;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    repository = createSupabaseRepository(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    return repository;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set: using the local JSON store, which can't save on Vercel.");
  }
  repository = createLocalRepository(getLocalOptions()!);
  return repository;
}
