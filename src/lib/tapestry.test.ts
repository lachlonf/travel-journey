import { describe, expect, it } from "vitest";
import { FALLBACK_HUE, TAPESTRY_HUES, tapestryHue } from "./tapestry";

const isHex = (colour: string) => /^#[0-9a-f]{6}$/.test(colour);

describe("tapestryHue", () => {
  it("gives a curated country its own hue", () => {
    expect(tapestryHue("PE")).toBe("#a8324a");
    expect(tapestryHue("BO")).toBe("#c2683c");
  });

  it("falls back rather than failing for a country nobody has chosen a hue for", () => {
    expect(tapestryHue("AQ")).toBe(FALLBACK_HUE);
  });

  it("wears the fallback for anything that isn't a country code either", () => {
    expect(tapestryHue("")).toBe(FALLBACK_HUE);
    expect(tapestryHue("PERU")).toBe(FALLBACK_HUE);
  });

  it("reads a code in any case", () => {
    expect(tapestryHue("pe")).toBe(TAPESTRY_HUES.PE);
    expect(tapestryHue("Pe")).toBe(TAPESTRY_HUES.PE);
  });
});

describe("the palette", () => {
  it("is keyed by ISO alpha-2 codes in upper case", () => {
    expect(Object.keys(TAPESTRY_HUES).every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
  });

  it("is drawn entirely in six-digit hex, fallback included", () => {
    expect(isHex(FALLBACK_HUE)).toBe(true);
    expect(Object.values(TAPESTRY_HUES).every(isHex)).toBe(true);
  });

  it("gives each country a distinct hue, so two neighbours never read as one", () => {
    const hues = Object.values(TAPESTRY_HUES);
    expect(new Set(hues).size).toBe(hues.length);
    expect(hues).not.toContain(FALLBACK_HUE);
  });
});
