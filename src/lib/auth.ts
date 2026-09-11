import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from "./session";

export async function isAdmin(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret());
}

/** Server Actions are reachable by direct POST, so every one checks this itself. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}
