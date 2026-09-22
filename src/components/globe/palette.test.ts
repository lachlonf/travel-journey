import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { asciiFragment } from "./shaders";
import { glslVec3, INK, PAPER, SHIMMER } from "./palette";

const stylesheet = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

function token(name: string): string {
  return stylesheet.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))![1];
}

/** Rough perceived brightness, enough to tell ink from paper. */
function brightness(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

describe("the globe's palette", () => {
  it("draws on the same paper the page does, because the glyph pass is opaque", () => {
    expect(PAPER).toBe(token("paper"));
  });

  it("draws in the one ink the rest of the site is drawn in", () => {
    expect(INK).toBe(token("ink"));
  });

  it("is ink on paper and not the other way round", () => {
    expect(brightness(INK)).toBeLessThan(brightness(PAPER));
  });

  it("sweeps a front darker than the ink it passes over, the only contrast paper has", () => {
    expect(brightness(SHIMMER)).toBeLessThan(brightness(INK));
  });
});

describe("glslVec3", () => {
  it("normalises each channel to 0–1", () => {
    expect(glslVec3("#000000")).toBe("vec3(0.0000, 0.0000, 0.0000)");
    expect(glslVec3("#ffffff")).toBe("vec3(1.0000, 1.0000, 1.0000)");
    expect(glslVec3("#1c1cc9")).toBe("vec3(0.1098, 0.1098, 0.7882)");
  });
});

describe("the glyph pass", () => {
  it("is compiled with the palette rather than with colours of its own", () => {
    for (const [name, colour] of [
      ["PAPER", PAPER],
      ["INK", INK],
      ["SHIMMER", SHIMMER],
    ]) {
      expect(asciiFragment).toContain(`const vec3 ${name} = ${glslVec3(colour)};`);
    }
  });
});
