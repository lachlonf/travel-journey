import { describe, expect, it } from "vitest";
import { createSessionToken, passwordMatches, verifySessionToken } from "./session";

const secret = "test-secret-that-is-long-enough";

describe("session tokens", () => {
  it("accepts a token it signed until it expires", async () => {
    const now = 1_000_000;
    const token = await createSessionToken(secret, now, 60_000);
    expect(await verifySessionToken(token, secret, now + 59_999)).toBe(true);
    expect(await verifySessionToken(token, secret, now + 60_001)).toBe(false);
  });

  it("rejects tampered tokens, other secrets, and junk", async () => {
    const now = 1_000_000;
    const token = await createSessionToken(secret, now, 60_000);
    const [exp, sig] = token.split(".");
    expect(await verifySessionToken(`${Number(exp) + 1e9}.${sig}`, secret, now)).toBe(false);
    expect(await verifySessionToken(token, "another-secret-entirely", now)).toBe(false);
    expect(await verifySessionToken("garbage", secret, now)).toBe(false);
    expect(await verifySessionToken(undefined, secret, now)).toBe(false);
  });
});

describe("passwordMatches", () => {
  it("compares passwords and never matches an unset password", async () => {
    expect(await passwordMatches("hunter2", "hunter2")).toBe(true);
    expect(await passwordMatches("hunter3", "hunter2")).toBe(false);
    expect(await passwordMatches("", "")).toBe(false);
  });
});
