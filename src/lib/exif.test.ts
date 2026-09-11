import { describe, expect, it } from "vitest";
import { normalizeExif } from "./exif";

describe("normalizeExif", () => {
  it("pulls GPS and the wall-clock date the photo was taken", () => {
    expect(
      normalizeExif({ latitude: -9.2112, longitude: -77.5466, DateTimeOriginal: new Date(2025, 5, 7, 23, 45) }),
    ).toEqual({ lat: -9.2112, lng: -77.5466, takenAt: "2025-06-07" });
  });

  it("falls back to CreateDate", () => {
    expect(normalizeExif({ CreateDate: new Date(2024, 0, 2) }).takenAt).toBe("2024-01-02");
  });

  it("returns nulls when there is nothing usable", () => {
    const empty = { lat: null, lng: null, takenAt: null };
    expect(normalizeExif(undefined)).toEqual(empty);
    expect(normalizeExif({ latitude: 0, longitude: 0 })).toEqual(empty);
    expect(normalizeExif({ latitude: 91, longitude: 10 })).toEqual(empty);
    expect(normalizeExif({ latitude: Number.NaN, longitude: 10, DateTimeOriginal: "nope" })).toEqual(empty);
  });
});
