import { join } from "node:path";
import { createLocalRepository } from "./local";
import { createSupabaseRepository } from "./supabase";
import type { JourneyRepository } from "./types";

let repository: JourneyRepository | undefined;

/** Supabase when it's configured, otherwise a JSON file under .data/ for local development. */
export function getRepository(): JourneyRepository {
  if (repository) return repository;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    repository = createSupabaseRepository(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set: using the local JSON store, which can't save on Vercel.");
    }
    const root = process.cwd();
    repository = createLocalRepository({
      dataFile: join(root, ".data", "journey.json"),
      seedFile: join(root, "data", "seed.json"),
      uploadsDir: join(root, "public", "uploads"),
      publicUrlPrefix: "/uploads",
    });
  }
  return repository;
}
