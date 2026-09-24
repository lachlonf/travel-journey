import { hostname, networkInterfaces, type NetworkInterfaceInfo } from "node:os";

/**
 * Every address this machine answers on besides localhost, for the dev server's
 * `allowedDevOrigins`.
 *
 * The site is made to be opened from a phone, and in development that means reaching
 * it at a LAN address. The dev server treats any origin it wasn't started on as
 * cross-origin and refuses every `/_next/*` asset to it with a 403 the page never
 * shows: the server-rendered HTML and the CSS still arrive, so the page looks
 * finished while no client JavaScript ever runs and the globe never mounts.
 *
 * Derived rather than written down, so a new lease or a different network doesn't
 * quietly take the globe away again.
 */
export function devOrigins(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
  name: string = hostname(),
): string[] {
  const addresses = Object.values(interfaces)
    .flatMap((details) => details ?? [])
    .filter((details) => details.family === "IPv4" && !details.internal)
    .map((details) => details.address);

  return [...new Set([...addresses, name.toLowerCase()])];
}
