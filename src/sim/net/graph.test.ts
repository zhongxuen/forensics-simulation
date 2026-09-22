import { describe, expect, it } from "vitest";
import { fixtureState } from "../__fixtures__/harness";
import { buildNetwork } from "./build";
import {
  canReach,
  hostById,
  hostByIp,
  reachableHosts,
  resolveHostname,
  ruleAllows,
  serviceAt,
  servicesOn,
} from "./graph";

const { network } = fixtureState();
const host = (id: string) => {
  const found = hostById(network, id);
  if (!found) throw new Error(`no host ${id}`);
  return found;
};

describe("network graph", () => {
  it("sorts subnets and gives every host its defaults", () => {
    expect(network.subnets).toEqual([
      { cidr: "10.0.1.0/24", name: "office" },
      { cidr: "10.0.2.0/24", name: "servers" },
    ]);
    expect(host("web-01").reachableFrom).toEqual(["10.0.1.0/24", "10.0.2.0/24"]);
    expect(host("web-01").respondsToPing).toBe(true);
    expect(host("printer-01").respondsToPing).toBe(false);
  });

  it("finds hosts by address and by name", () => {
    expect(hostByIp(network, "10.0.2.20")?.host.id).toBe("web-01");
    expect(hostByIp(network, "10.0.9.9")).toBeUndefined();
    expect(resolveHostname(network, "web-01")?.id).toBe("web-01");
    expect(resolveHostname(network, "WEB-01.corp.example.")?.id).toBe("web-01");
    expect(resolveHostname(network, "printer-01")?.id).toBe("printer-01");
    expect(resolveHostname(network, "nowhere")).toBeUndefined();
  });

  it("lists services sorted by port", () => {
    expect(servicesOn(network, "printer-01").map((s) => s.port)).toEqual([80, 9100]);
    expect(servicesOn(network, "no-such-host")).toEqual([]);
  });
});

describe("reachability", () => {
  it("lets hosts on the same network reach each other by default", () => {
    expect(canReach(network, "ws-01", "web-01")).toBe(true);
    expect(canReach(network, "ws-01", "printer-01")).toBe(true);
  });

  it("models a host that exists but is firewalled off", () => {
    expect(hostById(network, "vault-01")).toBeDefined();
    expect(canReach(network, "ws-01", "vault-01")).toBe(false);
    expect(canReach(network, "web-01", "vault-01")).toBe(true);
    expect(reachableHosts(network, "ws-01").map((h) => h.id)).toEqual([
      "web-01",
      "printer-01",
      "db-01",
    ]);
    expect(reachableHosts(network, "web-01").map((h) => h.id)).toContain("vault-01");
  });

  it("lets a service's own rule override the host's", () => {
    const db = host("db-01");
    const sql = serviceAt(db, 5432);
    const ssh = serviceAt(db, 22);
    expect(canReach(network, "ws-01", "db-01")).toBe(true);
    expect(canReach(network, "ws-01", "db-01", sql)).toBe(false);
    expect(canReach(network, "web-01", "db-01", sql)).toBe(true);
    expect(canReach(network, "ws-01", "db-01", ssh)).toBe(false);
    expect(canReach(network, "web-01", "db-01", ssh)).toBe(true); // web-01 has a 10.0.2.x address
  });

  it("always lets a host reach itself, and nothing reaches a host that doesn't exist", () => {
    expect(canReach(network, "vault-01", "vault-01")).toBe(true);
    expect(canReach(network, "ws-01", "ghost")).toBe(false);
  });

  it("matches rules by wildcard, host id, and subnet", () => {
    const ws = host("ws-01");
    expect(ruleAllows("*", ws)).toBe(true);
    expect(ruleAllows("ws-01", ws)).toBe(true);
    expect(ruleAllows("10.0.1.0/24", ws)).toBe(true);
    expect(ruleAllows("10.0.2.0/24", ws)).toBe(false);
    expect(ruleAllows("web-01", ws)).toBe(false);
  });

  it("is built from explicit data, so a rule can wall off a whole subnet", () => {
    const walled = buildNetwork({
      hosts: [
        {
          id: "a",
          hostname: "a",
          interfaces: [{ ip: "192.168.5.2", subnet: "192.168.5.0/24" }],
          os: { family: "linux", name: "Linux" },
        },
        {
          id: "b",
          hostname: "b",
          interfaces: [{ ip: "192.168.5.3", subnet: "192.168.5.0/24" }],
          os: { family: "linux", name: "Linux" },
          reachableFrom: [],
        },
        {
          id: "c",
          hostname: "c",
          interfaces: [{ ip: "192.168.6.3", subnet: "192.168.6.0/24" }],
          os: { family: "linux", name: "Linux" },
          reachableFrom: ["*"],
        },
      ],
    });
    expect(canReach(walled, "a", "b")).toBe(false);
    expect(canReach(walled, "a", "c")).toBe(true);
    expect(walled.subnets.map((s) => s.cidr)).toEqual(["192.168.5.0/24", "192.168.6.0/24"]);
  });
});
