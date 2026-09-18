/**
 * Collects objects in the Supabase photo bucket that no photo row points at. What counts as
 * collectable, and why an unreferenced object isn't enough on its own, is in `sweep.ts`.
 *
 *   npm run sweep              lists what would go, and removes nothing
 *   npm run sweep -- --delete  removes exactly what the listing showed
 *
 * Run by hand, by whoever owns the journal. Nothing schedules this on purpose: the bytes it removes
 * can't be brought back, and an unattended timer deleting files is a decision of its own.
 */
import { sweepPhotoBucket } from "../src/lib/repository/supabase.ts";

const args = process.argv.slice(2);
const deleteOrphans = args.includes("--delete");

const unknown = args.filter((arg) => arg !== "--delete");
if (unknown.length) {
  console.error(`Don't know what to do with ${unknown.join(" ")}. The only option is --delete.`);
  process.exit(2);
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Sweeping nothing quietly would read exactly like a clean bucket, which is the wrong answer to
  // give about deleting files. The local store litters `.data/pending-uploads/` in the same way;
  // `rm -rf .data/` is its sweep.
  console.error("There's no bucket to sweep: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY aren't both set in .env.local.");
  process.exit(1);
}

const { orphaned, recent, dangling } = await sweepPhotoBucket(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, deleteOrphans);

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

if (orphaned.length) {
  const what = count(orphaned.length, "object", "objects");
  console.log(`${deleteOrphans ? "Removed" : "Would remove"} ${what} no photo points at:`);
  for (const object of orphaned) console.log(`  ${object.path}  (${object.createdAt ?? "no creation time"})`);
} else {
  console.log("Nothing to collect: every object old enough to judge has a photo pointing at it.");
}

if (recent.length) {
  const what = count(recent.length, "object", "objects");
  console.log(`\nLeft alone: ${what} with no photo yet, too recent to be sure of not still being confirmed.`);
}

if (dangling.length) {
  const what = count(dangling.length, "photo row points", "photo rows point");
  console.log(`\n${what} at an object that isn't in the bucket.`);
  console.log("Nothing here touches rows, and each of these shows a broken image on its place:");
  for (const path of dangling) console.log(`  ${path}`);
}

if (orphaned.length && !deleteOrphans) {
  console.log("\nNothing was removed. Read the list above, then run `npm run sweep -- --delete`.");
}
