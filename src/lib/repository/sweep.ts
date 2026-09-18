/**
 * Which stored objects nobody is using any more. Bytes reach the photo bucket that no photo row
 * ever points at: an upload confirmed too late, a browser that went away between sending the bytes
 * and confirming them, or bytes turned away for not being the image they claimed and deliberately
 * left where they were. Nothing collects them, so this decides what may go.
 *
 * Deliberately pure and free of any storage call: this is the one place a mistake deletes a photo
 * someone still has on their journal, so it is the one place that can be tested without mocks.
 */

/** An object in the photo bucket as the sweep sees it: where it is, and when it turned up. */
export interface StoredObject {
  /** `<placeId>/<uuid>.<ext>`, the same shape a photo row's `storage_path` holds. */
  path: string;
  /** ISO 8601, or null when storage recorded none. */
  createdAt: string | null;
}

/**
 * How old an unreferenced object must be before it counts as abandoned. The true floor is two
 * hours, the life of a Supabase signed upload URL, because until then bytes can still legitimately
 * arrive and be confirmed. A day on top of that covers a confirm that is being retried, a clock
 * that disagrees with storage, and a stuck upload somebody is in the middle of looking at.
 */
export const SWEEP_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export interface SweepPlan {
  /** No row points at these and they're past the age: what a sweep removes. */
  orphaned: StoredObject[];
  /** No row points at these either, but they're still young enough to be mid-confirmation. */
  recent: StoredObject[];
  /** `storage_path` values with no object behind them. Reported, never acted on. */
  dangling: string[];
}

/**
 * Sorts one bucket listing against the paths the photo rows hold. An object with no row is not
 * evidence of abandonment on its own — an upload being confirmed right now has no row either —
 * so age is what separates the two, and anything storage gave no creation time for is left alone.
 */
export function planSweep(objects: StoredObject[], storagePaths: string[], now: number): SweepPlan {
  const referenced = new Set(storagePaths);
  const stored = new Set(objects.map((o) => o.path));

  const plan: SweepPlan = {
    orphaned: [],
    recent: [],
    // Through a set, so two rows sharing one missing object are one thing to go and look at.
    dangling: [...new Set(storagePaths.filter((path) => !stored.has(path)))],
  };

  for (const object of objects) {
    if (referenced.has(object.path)) continue;
    const createdAt = object.createdAt === null ? NaN : Date.parse(object.createdAt);
    const collectable = now - createdAt > SWEEP_MIN_AGE_MS;
    (collectable ? plan.orphaned : plan.recent).push(object);
  }

  return plan;
}
