"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addVisit, removeVisit } from "@/app/admin/actions";
import { FormStatus } from "@/app/admin/FormStatus";
import type { CommandResult } from "@/lib/admin-commands";
import { formatDate } from "@/lib/format";
import type { Place } from "@/lib/types";

/** Which change is in flight, so only its own button waits. A date can never be the one being added. */
const ADDING = "add";

/** Every day the owner was here: going back adds a date, and a date entered wrongly comes off. */
export function VisitDates({ placeId, visitedOn }: { placeId: string; visitedOn: string[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  const [busy, setBusy] = useState<string | null>(null);

  /** Runs one change to the dates, reporting whatever the command says about it. */
  async function run(which: string, work: () => Promise<CommandResult<Place>>, success: string) {
    setBusy(which);
    setStatus({});
    try {
      const result = await work();
      if (!result.ok) {
        setStatus({ error: result.error.message });
        return;
      }
      setStatus({ message: success });
      setDate("");
      router.refresh();
    } catch (error) {
      setStatus({ error: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="form">
      <p className="hint">Every date you went. They stay in order, and the same day is never recorded twice.</p>

      {visitedOn.length === 0 ? (
        <p className="muted">No visit dates yet.</p>
      ) : (
        <ul className="admin-list">
          {visitedOn.map((visit) => (
            <li key={visit}>
              <span>{formatDate(visit)}</span>
              <div className="admin-list-actions">
                {/* No confirmation: a date removed by mistake is typed straight back in. */}
                <button
                  className="btn btn-danger"
                  type="button"
                  aria-label={`Remove the visit on ${formatDate(visit)}`}
                  disabled={busy !== null}
                  onClick={() => run(visit, () => removeVisit({ placeId, date: visit }), `Removed the visit on ${formatDate(visit)}.`)}
                >
                  {busy === visit ? "Removing…" : "Remove"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="form-row">
        <div className="field">
          <label htmlFor="add-visit">Add a visit</label>
          <input id="add-visit" type="date" className="input" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>

      <FormStatus {...status} />
      <div className="block-actions">
        <button
          className="btn btn-primary"
          type="button"
          disabled={!date || busy !== null}
          onClick={() => run(ADDING, () => addVisit({ placeId, date }), `Added the visit on ${formatDate(date)}.`)}
        >
          {busy === ADDING ? "Adding…" : "Add visit"}
        </button>
      </div>
    </div>
  );
}
