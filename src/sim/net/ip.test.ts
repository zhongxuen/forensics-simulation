import { describe, expect, it } from "vitest";
import {
  cidrContains,
  cidrSize,
  compareIps,
  formatCidr,
  formatIpv4,
  isReservedIp,
  isReservedRange,
  parseCidr,
  parseIpv4,
} from "./ip";
import { isFictionalHostname, isValidHostname } from "./names";

const cidr = (text: string) => {
  const range = parseCidr(text);
  if (!range) throw new Error(`bad range ${text}`);
  return range;
};

describe("IPv4 parsing", () => {
  it("parses dotted quads strictly", () => {
    expect(parseIpv4("10.0.1.20")).toBe(0x0a000114);
    expect(formatIpv4(0x0a000114)).toBe("10.0.1.20");
    expect(formatIpv4(parseIpv4("255.255.255.255") as number)).toBe("255.255.255.255");
    for (const bad of [
      "10.0.1",
      "10.0.1.256",
      "10.0.01.1",
      "10.0.1.x",
      "",
      "1.2.3.4.5",
      " 10.0.1.1",
    ]) {
      expect(parseIpv4(bad), bad).toBeUndefined();
    }
  });

  it("parses ranges, clearing host bits unless strict", () => {
    expect(formatCidr(cidr("10.0.1.5/24"))).toBe("10.0.1.0/24");
    expect(parseCidr("10.0.1.5/24", { strict: true })).toBeUndefined();
    expect(parseCidr("10.0.1.0/33")).toBeUndefined();
    expect(parseCidr("10.0.1.0/08")).toBeUndefined();
    expect(parseCidr("0.0.0.0/0")).toEqual({ base: 0, prefix: 0 });
  });

  it("checks membership and size", () => {
    const office = parseCidr("10.0.1.0/24", { strict: true });
    if (!office) throw new Error("bad range");
    expect(cidrContains(office, parseIpv4("10.0.1.255") as number)).toBe(true);
    expect(cidrContains(office, parseIpv4("10.0.2.0") as number)).toBe(false);
    expect(cidrSize(office)).toBe(256);
    expect(cidrContains({ base: 0, prefix: 0 }, parseIpv4("203.0.113.9") as number)).toBe(true);
  });

  it("sorts addresses numerically, not alphabetically", () => {
    expect(["10.0.1.100", "10.0.1.9", "10.0.1.20"].sort(compareIps)).toEqual([
      "10.0.1.9",
      "10.0.1.20",
      "10.0.1.100",
    ]);
  });
});

describe("scope", () => {
  it("knows the reserved ranges", () => {
    for (const ip of [
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.1.1",
      "127.0.0.1",
      "192.0.2.10",
      "198.51.100.1",
      "203.0.113.200",
    ]) {
      expect(isReservedIp(parseIpv4(ip) as number), ip).toBe(true);
    }
    for (const ip of ["172.32.0.1", "100.64.0.1", "11.0.0.1"]) {
      expect(isReservedIp(parseIpv4(ip) as number), ip).toBe(false);
    }
  });

  it("only accepts a range that sits entirely inside one reserved block", () => {
    expect(isReservedRange(cidr("10.0.0.0/16"))).toBe(true);
    expect(isReservedRange(cidr("172.16.0.0/11"))).toBe(false);
    expect(isReservedRange(cidr("0.0.0.0/0"))).toBe(false);
  });

  it("accepts only fictional hostnames", () => {
    for (const name of [
      "web-01",
      "web-01.corp.example",
      "files.test",
      "db.internal",
      "printer.home.arpa",
      "site.example.org",
    ]) {
      expect(isFictionalHostname(name), name).toBe(true);
    }
    for (const name of ["portal.corp", "files.intranet", "-bad", "a..b", "under_score"]) {
      expect(isFictionalHostname(name), name).toBe(false);
    }
    expect(isValidHostname("portal.corp")).toBe(true);
  });
});
