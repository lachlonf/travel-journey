import { connection } from "next/server";
import { getRepository } from "./repository";
import type { JourneyData } from "./types";

/** Always read fresh: the journey changes whenever you add a place. */
export async function loadJourneyData(): Promise<JourneyData> {
  await connection();
  return getRepository().load();
}
