import { describe, expect, it } from "vitest";
import { FALLBACK_HUE, tapestryHue } from "@/lib/tapestry";
import { channels } from "./ink";
import { writeTapestryHues } from "./hues";

/** The bytes a hex ends up as in a row of the texture. */
function bytes(hex: `#${string}`): number[] {
  return channels(hex).map((channel) => Math.round(channel * 255));
}

function row(rows: Uint8Array, index: number): number[] {
  return [...rows.slice(index * 4, index * 4 + 3)];
}

describe("writeTapestryHues", () => {
  it("puts a country's hue in the row the shader looks it up by", () => {
    const rows = new Uint8Array(256 * 4);
    writeTapestryHues(rows, [{ code: "PE", index: 7 }]);
    // Cochineal, #a8324a, as the three bytes a shader reads back as that colour.
    expect(row(rows, 7)).toEqual([168, 50, 74]);
  });

  it("gives a country outside the palette the fallback rather than nothing", () => {
    const rows = new Uint8Array(256 * 4);
    writeTapestryHues(rows, [{ code: "AQ", index: 3 }]);
    expect(row(rows, 3)).toEqual(bytes(FALLBACK_HUE));
  });

  it("keeps two neighbours apart", () => {
    const rows = new Uint8Array(256 * 4);
    writeTapestryHues(rows, [
      { code: "PE", index: 1 },
      { code: "BO", index: 2 },
    ]);
    expect(row(rows, 1)).not.toEqual(row(rows, 2));
  });

  it("reads a code in any case, as the journey may store it either way", () => {
    const rows = new Uint8Array(256 * 4);
    writeTapestryHues(rows, [{ code: "pe", index: 5 }]);
    expect(row(rows, 5)).toEqual(bytes(tapestryHue("PE")));
  });

  it("leaves every country nobody has visited blank", () => {
    const rows = new Uint8Array(256 * 4);
    writeTapestryHues(rows, [{ code: "PE", index: 7 }]);
    expect(row(rows, 8)).toEqual([0, 0, 0]);
  });

  it("clears a country the journey no longer holds", () => {
    const rows = new Uint8Array(256 * 4);
    writeTapestryHues(rows, [{ code: "PE", index: 7 }]);
    writeTapestryHues(rows, [{ code: "BO", index: 2 }]);
    expect(row(rows, 7)).toEqual([0, 0, 0]);
  });
});
