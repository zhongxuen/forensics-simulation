import { describe, expect, it } from "vitest";
import { fixtureState, run } from "../__fixtures__/harness";
import { FIXTURE_SCENARIO } from "../__fixtures__/scenario";
import { createInitialState } from "../core/scenario";
import { deserializeState, serializeState } from "../core/serialize";
import {
  emptyDiscovery,
  markAccessed,
  markPortScanned,
  recordHost,
  recordService,
} from "./discovery";

describe("discovery state", () => {
  it("starts empty and records a host once", () => {
    const first = recordHost(emptyDiscovery(), {
      hostId: "web-01",
      ip: "10.0.1.20",
      hostname: "web-01",
      via: "netscan",
      tick: 3,
    });
    expect(first.isNew).toBe(true);
    expect(first.discovery.hosts["web-01"]).toEqual({
      hostId: "web-01",
      ips: ["10.0.1.20"],
      hostname: "web-01",
      firstSeenTick: 3,
      via: "netscan",
      answered: true,
      portScanned: false,
      accessed: false,
      services: {},
    });
    const again = recordHost(first.discovery, {
      hostId: "web-01",
      ip: "10.0.1.20",
      via: "webprobe",
      tick: 9,
    });
    expect(again.isNew).toBe(false);
    expect(again.discovery).toBe(first.discovery);
  });

  it("adds a second address without calling the host new", () => {
    const one = recordHost(emptyDiscovery(), {
      hostId: "web-01",
      ip: "10.0.2.20",
      via: "netscan",
      tick: 1,
    }).discovery;
    const two = recordHost(one, { hostId: "web-01", ip: "10.0.1.20", via: "netscan", tick: 2 });
    expect(two.isNew).toBe(false);
    expect(two.discovery.hosts["web-01"]?.ips).toEqual(["10.0.1.20", "10.0.2.20"]);
  });

  it("records services, filling in details later without losing first-seen info", () => {
    const base = recordHost(emptyDiscovery(), {
      hostId: "h",
      ip: "10.0.1.20",
      via: "netscan",
      tick: 1,
    }).discovery;
    const found = recordService(base, "h", {
      port: 80,
      protocol: "tcp",
      name: "http",
      via: "netscan",
      tick: 1,
    });
    expect(found.isNew).toBe(true);
    const fingerprinted = recordService(found.discovery, "h", {
      port: 80,
      protocol: "tcp",
      name: "http",
      product: "httpd",
      version: "2.4.58",
      via: "webprobe",
      tick: 4,
    });
    expect(fingerprinted.isNew).toBe(false);
    expect(fingerprinted.discovery.hosts.h?.services["80/tcp"]).toEqual({
      port: 80,
      protocol: "tcp",
      name: "http",
      product: "httpd",
      version: "2.4.58",
      firstSeenTick: 1,
      via: "netscan",
    });
    expect(() =>
      recordService(emptyDiscovery(), "ghost", {
        port: 1,
        protocol: "tcp",
        name: "x",
        via: "t",
        tick: 1,
      }),
    ).toThrow();
  });

  it("keeps a host heard of apart from one that answered, and never un-answers it", () => {
    const heard = recordHost(emptyDiscovery(), {
      hostId: "web-01",
      ip: "10.0.1.20",
      via: "briefing",
      tick: 0,
      answered: false,
    }).discovery;
    expect(heard.hosts["web-01"]?.answered).toBe(false);
    const answered = recordHost(heard, {
      hostId: "web-01",
      ip: "10.0.1.20",
      via: "netscan",
      tick: 2,
    });
    expect(answered.isNew).toBe(false);
    expect(answered.discovery.hosts["web-01"]).toMatchObject({
      answered: true,
      via: "briefing",
      firstSeenTick: 0,
    });
    const again = recordHost(answered.discovery, {
      hostId: "web-01",
      ip: "10.0.1.20",
      via: "briefing",
      tick: 3,
      answered: false,
    });
    expect(again.discovery).toBe(answered.discovery);
  });

  it("tracks port-scanned and accessed separately", () => {
    const base = recordHost(emptyDiscovery(), {
      hostId: "h",
      ip: "10.0.1.20",
      via: "netscan",
      tick: 1,
    }).discovery;
    expect(markPortScanned(base, "h", "Linux").hosts.h).toMatchObject({
      portScanned: true,
      osGuess: "Linux",
      accessed: false,
    });
    expect(markAccessed(base, "h").hosts.h).toMatchObject({ portScanned: false, accessed: true });
  });
});

describe("snapshots", () => {
  it("round-trips a host heard of in the briefing", () => {
    const state = createInitialState({ ...FIXTURE_SCENARIO, knownHosts: ["web-01"] }, 1);
    const restored = deserializeState(serializeState(state));
    expect(restored.ok && restored.value.discovery.hosts["web-01"]?.answered).toBe(false);
  });

  it("loads snapshots from before `answered` existed, counting their hosts as answered", () => {
    const envelope = JSON.parse(
      serializeState(run(fixtureState(), "ping", "-c", "1", "web-01").state),
    );
    for (const host of Object.values(envelope.state.discovery.hosts)) {
      delete (host as { answered?: boolean }).answered;
    }
    const restored = deserializeState(JSON.stringify(envelope));
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.discovery.hosts["web-01"]?.answered).toBe(true);
    expect(restored.value.discovery.hosts["ws-01"]?.answered).toBe(true);
  });

  it("still refuses an `answered` that isn't true or false", () => {
    const envelope = JSON.parse(serializeState(fixtureState()));
    envelope.state.discovery.hosts["ws-01"].answered = "yes";
    const restored = deserializeState(JSON.stringify(envelope));
    expect(restored.ok || restored.error.reason).toMatch(/answered: expected true or false/);
  });
});
