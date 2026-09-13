"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePlace } from "@/app/admin/actions";
import { FormStatus } from "@/app/admin/FormStatus";

interface DeletePlaceProps {
  placeId: string;
  name: string;
  /** Cities fold spots into them, and one with spots left is refused, so the warning says so. */
  isCity: boolean;
}

/** Removes a place for good, with its photos and their files. Two taps, because none of it comes back. */
export function DeletePlace({ placeId, name, isCity }: DeletePlaceProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const result = await deletePlace(placeId);
      if (!result.ok) {
        // A city that still has spots lands here: the command says which, and the place stays.
        setError(result.error.message);
        setConfirming(false);
        return;
      }
      // This page is about a place that no longer exists, so there's nowhere to stay.
      router.push("/admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="form">
      <p className="hint">
        Deleting {name} deletes its photos and their files too. There’s no undo.
        {isCity && " A city that still has spots folded into it can’t be deleted until those spots are."}
      </p>

      <FormStatus error={error} />

      <div className="block-actions">
        {confirming ? (
          <>
            <button className="btn" type="button" disabled={busy} onClick={() => setConfirming(false)}>
              Keep
            </button>
            <button className="btn btn-danger" type="button" disabled={busy} onClick={remove}>
              {busy ? "Deleting…" : "Delete for good"}
            </button>
          </>
        ) : (
          <button className="btn btn-danger" type="button" aria-label={`Delete ${name}`} onClick={() => setConfirming(true)}>
            Delete this {isCity ? "city" : "spot"}
          </button>
        )}
      </div>
    </div>
  );
}
