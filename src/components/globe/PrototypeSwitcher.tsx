"use client";

/** PROTOTYPE (#18) — the variant bar. Throwaway; lives on `prototype/tapestry-unlock` only. */

import { useEffect } from "react";
import { VARIANT_KEYS, VARIANT_NAMES, type VariantKey } from "./prototype-unlock";

const SEEN_KEY = "journey:seen-countries";

export function PrototypeSwitcher({ current, onChange }: { current: VariantKey; onChange: (variant: VariantKey) => void }) {
  const step = (delta: number) => {
    const next = (VARIANT_KEYS.indexOf(current) + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length;
    onChange(VARIANT_KEYS[next]);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (process.env.NODE_ENV === "production") return null;

  const replay = () => {
    try {
      localStorage.removeItem(SEEN_KEY);
    } catch {
      // Nothing to forget.
    }
    location.reload();
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.35rem 0.5rem",
        borderRadius: "999px",
        background: "#111",
        color: "#fff",
        font: "12px ui-monospace, monospace",
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
      }}
    >
      <button type="button" onClick={() => step(-1)} style={button} aria-label="Previous variant">
        ←
      </button>
      {/* The variant is read from the URL on the client, so the server's guess differs. */}
      <span suppressHydrationWarning style={{ padding: "0 0.6rem", whiteSpace: "nowrap" }}>
        {current} ({VARIANT_NAMES[current]})
      </span>
      <button type="button" onClick={() => step(1)} style={button} aria-label="Next variant">
        →
      </button>
      <button type="button" onClick={replay} style={{ ...button, width: "auto", padding: "0 0.6rem", marginLeft: "0.35rem" }}>
        replay unlocks
      </button>
    </div>
  );
}

const button: React.CSSProperties = {
  width: "1.75rem",
  height: "1.75rem",
  borderRadius: "999px",
  border: "1px solid #444",
  background: "#222",
  color: "#fff",
  font: "inherit",
  cursor: "pointer",
};
