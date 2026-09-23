import { describe, expect, it } from "vitest";
import { MAX_TILT, MIN_TILT, PRINT_SIZES, printGeometry } from "./print";

const ids = Array.from({ length: 400 }, (_, i) => `photo-${i}`);

describe("printGeometry", () => {
  it("gives the same photo the same geometry every time it is asked", () => {
    expect(printGeometry("a1b2")).toEqual(printGeometry("a1b2"));
  });

  it("is pinned to exact values, so a print never moves between browsers or builds", () => {
    expect(printGeometry("a1b2")).toEqual({ tilt: 0.4, size: "wide" });
    expect(printGeometry("9f3c2e1a-0000-4000-8000-000000000001")).toEqual({ tilt: -1.4, size: "wide" });
    expect(printGeometry("")).toEqual({ tilt: 0.8, size: "wide" });
  });

  it("tells two photos apart, rather than laying a whole story out identically", () => {
    const shapes = new Set(ids.map((id) => JSON.stringify(printGeometry(id))));
    expect(shapes.size).toBeGreaterThan(10);
  });

  // Pinned rather than read from the module: the stylesheet keeps room either
  // side of a print for the corner MAX_TILT throws out, so the range can't be
  // widened silently — this fails first, and points at the CSS that must follow.
  it("leans by between four tenths of a degree and one and two fifths", () => {
    expect([MIN_TILT, MAX_TILT]).toEqual([0.4, 1.4]);
  });

  it("keeps every tilt within a range that reads as hand-placed rather than broken", () => {
    for (const id of ids) {
      const { tilt } = printGeometry(id);
      expect(Math.abs(tilt)).toBeLessThanOrEqual(MAX_TILT);
      expect(Math.abs(tilt)).toBeGreaterThanOrEqual(MIN_TILT);
    }
  });

  it("tilts each way, so a story leans as a scrapbook rather than as a slope", () => {
    const tilts = ids.map((id) => printGeometry(id).tilt);
    expect(tilts.some((tilt) => tilt > 0)).toBe(true);
    expect(tilts.some((tilt) => tilt < 0)).toBe(true);
  });

  it("only ever names a size the stylesheet knows how to draw", () => {
    for (const id of ids) expect(PRINT_SIZES).toContain(printGeometry(id).size);
  });

  it("reaches every size, so sizes vary down a column", () => {
    const sizes = new Set(ids.map((id) => printGeometry(id).size));
    expect([...sizes].sort()).toEqual([...PRINT_SIZES].sort());
  });

  it("picks a size independently of which way the print leans", () => {
    const leftSizes = new Set(ids.map((id) => printGeometry(id)).filter((g) => g.tilt < 0).map((g) => g.size));
    expect(leftSizes.size).toBeGreaterThan(1);
  });

  it("holds its nerve on ids that aren't tidy", () => {
    for (const id of ["", " ", "é", "0", "photo/1?x=2", "A".repeat(500)]) {
      const { tilt, size } = printGeometry(id);
      expect(Number.isFinite(tilt)).toBe(true);
      expect(PRINT_SIZES).toContain(size);
    }
  });

  it("reads an id exactly, so a photo is not confused with its neighbour", () => {
    expect(printGeometry("photo-1")).not.toEqual(printGeometry("photo-2"));
    // Only a few dozen geometries exist, so any two ids may share one; the point
    // is that a difference in an id can reach the geometry at all.
    expect(ids.some((id) => printGeometry(id).tilt !== printGeometry(id.toUpperCase()).tilt)).toBe(true);
  });
});
