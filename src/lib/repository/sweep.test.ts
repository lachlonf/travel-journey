import { describe, expect, it } from "vitest";
import { planSweep, SWEEP_MIN_AGE_MS, type StoredObject } from "./sweep";

const NOW = Date.parse("2026-09-18T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const HOUR = 60 * 60 * 1000;

const object = (path: string, age: number): StoredObject => ({ path, createdAt: ago(age) });

describe("planSweep", () => {
  it("collects an object no row points at, once it's past the age", () => {
    const old = object("place-1/a.jpg", SWEEP_MIN_AGE_MS + HOUR);
    expect(planSweep([old], [], NOW)).toEqual({ orphaned: [old], recent: [], dangling: [] });
  });

  it("leaves an object with no row alone while it's young enough to still be confirmed", () => {
    const fresh = object("place-1/a.jpg", HOUR);
    expect(planSweep([fresh], [], NOW)).toEqual({ orphaned: [], recent: [fresh], dangling: [] });
  });

  // The floor is Supabase's two-hour signed upload; the rest is margin for a retrying confirm or a
  // clock that disagrees. An object exactly on it is left, so the boundary errs towards keeping bytes.
  it("leaves an object sitting exactly on the age", () => {
    expect(planSweep([object("place-1/a.jpg", SWEEP_MIN_AGE_MS)], [], NOW).orphaned).toEqual([]);
  });

  it("never collects an object a photo row points at, however old it is", () => {
    const ancient = object("place-1/a.jpg", 365 * 24 * HOUR);
    expect(planSweep([ancient], ["place-1/a.jpg"], NOW)).toEqual({ orphaned: [], recent: [], dangling: [] });
  });

  it("reports a row whose object is gone, without collecting anything for it", () => {
    expect(planSweep([], ["place-1/missing.jpg"], NOW)).toEqual({ orphaned: [], recent: [], dangling: ["place-1/missing.jpg"] });
  });

  it("sorts each group of one bucket's worth into the three answers", () => {
    const orphan = object("place-1/orphan.jpg", 3 * 24 * HOUR);
    const fresh = object("place-1/fresh.jpg", 5 * 60 * 1000);
    const kept = object("place-2/kept.jpg", 3 * 24 * HOUR);
    const plan = planSweep([orphan, fresh, kept], ["place-2/kept.jpg", "place-3/gone.jpg"], NOW);
    expect(plan).toEqual({ orphaned: [orphan], recent: [fresh], dangling: ["place-3/gone.jpg"] });
  });

  // Storage reporting no creation time would otherwise read as the epoch, making every such object
  // ancient and collectable. Unknown age means unknown, which means left alone.
  it("leaves an object alone when storage gave it no creation time", () => {
    const undated: StoredObject = { path: "place-1/a.jpg", createdAt: null };
    expect(planSweep([undated], [], NOW)).toEqual({ orphaned: [], recent: [undated], dangling: [] });
  });

  // Two rows can point at one object until a unique index on storage_path stops them. Reporting
  // the same missing path twice would read as two problems to go and chase down.
  it("names a missing object once, however many rows point at it", () => {
    expect(planSweep([], ["place-1/gone.jpg", "place-1/gone.jpg"], NOW).dangling).toEqual(["place-1/gone.jpg"]);
  });
});
