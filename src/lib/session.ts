// Uses Web Crypto so it runs in both the Node runtime and the proxy.

export const SESSION_COOKIE = "journey_admin";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const sessionSecret = () => process.env.SESSION_SECRET ?? "";

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** `<expiry ms>.<signature>` — no user data to carry, since the only user is you. */
export async function createSessionToken(secret: string, now = Date.now(), ttlMs = SESSION_TTL_MS): Promise<string> {
  const exp = String(now + ttlMs);
  return `${exp}.${toBase64Url(await hmac(secret, exp))}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token || !secret) return false;
  const [exp, sig, ...rest] = token.split(".");
  if (!exp || !sig || rest.length || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return equalBytes(encoder.encode(toBase64Url(await hmac(secret, exp))), encoder.encode(sig));
}

export async function passwordMatches(input: string, expected: string): Promise<boolean> {
  if (!expected) return false;
  // Compare digests so timing doesn't leak the password's length or prefix.
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(s)));
  const [a, b] = await Promise.all([digest(input), digest(expected)]);
  return equalBytes(a, b);
}
