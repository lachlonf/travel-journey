import { describe, expect, it } from "vitest";
import { bytesLookLike, IMAGE_SIGNATURE_BYTES } from "./image-bytes";
import { IMAGE_TYPES } from "./types";

/** A head of the right length, padded so a short fixture still reaches the bytes a check reads. */
const head = (...bytes: (number | string)[]) => {
  const flat = bytes.flatMap((b) => (typeof b === "string" ? [...b].map((c) => c.charCodeAt(0)) : [b]));
  return new Uint8Array([...flat, ...Array(Math.max(0, IMAGE_SIGNATURE_BYTES - flat.length)).fill(0)]);
};

const JPEG = head(0xff, 0xd8, 0xff, 0xe0);
const PNG = head(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = head("RIFF", 0x24, 0x00, 0x00, 0x00, "WEBP");
const AVIF = head(0x00, 0x00, 0x00, 0x20, "ftypavif");
const HEIC = head(0x00, 0x00, 0x00, 0x18, "ftypheic");

describe("bytesLookLike", () => {
  it.each([
    ["image/jpeg", JPEG],
    ["image/png", PNG],
    ["image/webp", WEBP],
    ["image/avif", AVIF],
    ["image/heic", HEIC],
  ])("accepts bytes that really are %s", (contentType, bytes) => {
    expect(bytesLookLike(contentType, bytes)).toBe(true);
  });

  it("accepts the other brands the HEIC and AVIF containers are stamped with", () => {
    expect(bytesLookLike("image/heic", head(0x00, 0x00, 0x00, 0x18, "ftypmif1"))).toBe(true);
    expect(bytesLookLike("image/avif", head(0x00, 0x00, 0x00, 0x20, "ftypavis"))).toBe(true);
  });

  it("rejects text wearing an image's name", () => {
    expect(bytesLookLike("image/jpeg", head("not a photo"))).toBe(false);
  });

  it("rejects one image format declared as another", () => {
    expect(bytesLookLike("image/jpeg", PNG)).toBe(false);
    expect(bytesLookLike("image/png", JPEG)).toBe(false);
    // Both are ISO base media containers, so only the brand tells them apart.
    expect(bytesLookLike("image/avif", HEIC)).toBe(false);
    expect(bytesLookLike("image/heic", AVIF)).toBe(false);
  });

  it("rejects a RIFF container that isn't WebP", () => {
    expect(bytesLookLike("image/webp", head("RIFF", 0x24, 0x00, 0x00, 0x00, "WAVE"))).toBe(false);
  });

  it("rejects bytes that stop before the signature does", () => {
    expect(bytesLookLike("image/jpeg", new Uint8Array([0xff, 0xd8]))).toBe(false);
    expect(bytesLookLike("image/png", new Uint8Array())).toBe(false);
    expect(bytesLookLike("image/webp", new Uint8Array([...head("RIFF")].slice(0, 10)))).toBe(false);
  });

  it("rejects a type outside the allowlist, however its bytes start", () => {
    expect(bytesLookLike("image/svg+xml", head("<svg>"))).toBe(false);
    expect(bytesLookLike("", JPEG)).toBe(false);
  });

  it("reads a whole file, not just its head, so a caller holding one needn't cut it down", () => {
    expect(bytesLookLike("image/jpeg", new Uint8Array([...JPEG, ...Array(5000).fill(7)]))).toBe(true);
  });

  // A type uploads are taken for but that nothing here can check would be back to passing on its
  // declared type alone, which is the gap this module exists to close.
  it.each(IMAGE_TYPES)("has a signature to check %s against, for every type uploads are taken for", (contentType) => {
    const fixtures = [JPEG, PNG, WEBP, AVIF, HEIC];
    expect(fixtures.some((bytes) => bytesLookLike(contentType, bytes))).toBe(true);
  });
});
