import { describe, expect, it } from "vitest";
import * as ink from "./ink";
import { channels, glslVec3, inkTokens, INK, PAPER, type Hex } from "./ink";

/** Every colour the module exports, in the order it declares them. */
function colours(): [string, Hex][] {
  return Object.entries(ink).filter(([, value]) => typeof value === "string" && value.startsWith("#")) as [
    string,
    Hex,
  ][];
}

/** Rough perceived brightness, enough to tell ink from paper. */
function brightness(hex: Hex): number {
  const [r, g, b] = channels(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

describe("the globe's paper and ink", () => {
  it("is ink on paper and not the other way round", () => {
    expect(brightness(INK)).toBeLessThan(brightness(PAPER));
  });

  it("has no third colour, so tapestry hue is the only colour on the globe", () => {
    expect(colours().map(([name]) => name)).toEqual(["PAPER", "INK"]);
  });

  // The glyph pass takes these by compiling `glslVec3(PAPER)` into its source, so
  // nothing here asserts what the shader says: there is only one copy to say it.
  it("hands the stylesheet every colour it has, so the page rests on the globe's paper", () => {
    expect(Object.entries(inkTokens())).toEqual(colours().map(([name, hex]) => [`--${name.toLowerCase()}`, hex]));
  });
});

describe("glslVec3", () => {
  it("normalises each channel to 0–1", () => {
    expect(glslVec3("#000000")).toBe("vec3(0.0000, 0.0000, 0.0000)");
    expect(glslVec3("#ffffff")).toBe("vec3(1.0000, 1.0000, 1.0000)");
    expect(glslVec3("#1c1cc9")).toBe("vec3(0.1098, 0.1098, 0.7882)");
  });
});
