import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it } from "vitest";
import { devOrigins } from "./dev-origins";

const ipv4 = (address: string, internal = false): NetworkInterfaceInfo => ({
  address,
  netmask: "255.255.255.0",
  family: "IPv4",
  mac: "00:00:00:00:00:00",
  internal,
  cidr: `${address}/24`,
});

const ipv6 = (address: string): NetworkInterfaceInfo => ({
  address,
  netmask: "ffff:ffff:ffff:ffff::",
  family: "IPv6",
  mac: "00:00:00:00:00:00",
  internal: false,
  cidr: `${address}/64`,
  scopeid: 0,
});

describe("devOrigins", () => {
  it("includes the address a phone on the same network would use", () => {
    expect(devOrigins({ en0: [ipv4("192.168.0.45")] }, "host")).toContain("192.168.0.45");
  });

  it("includes this machine by name, lowercased", () => {
    expect(devOrigins({}, "Lachlons-Air.modem")).toEqual(["lachlons-air.modem"]);
  });

  it("gathers addresses across every interface", () => {
    const origins = devOrigins({ en0: [ipv4("192.168.0.45")], en1: [ipv4("10.0.0.8")] }, "host");
    expect(origins).toEqual(expect.arrayContaining(["192.168.0.45", "10.0.0.8"]));
  });

  it("leaves out loopback and IPv6, which the dev server already answers on or is never reached at", () => {
    const origins = devOrigins({ lo0: [ipv4("127.0.0.1", true), ipv6("::1")], en0: [ipv4("192.168.0.45")] }, "host");
    expect(origins).toEqual(["192.168.0.45", "host"]);
  });

  it("names each origin once, even when two interfaces share an address", () => {
    const origins = devOrigins({ en0: [ipv4("192.168.0.45")], bridge0: [ipv4("192.168.0.45")] }, "host");
    expect(origins).toEqual(["192.168.0.45", "host"]);
  });

  it("copes with an interface the system reports as absent", () => {
    expect(devOrigins({ en0: undefined, en1: [ipv4("192.168.0.45")] }, "host")).toEqual(["192.168.0.45", "host"]);
  });
});
