import { describe, expect, it } from "vitest";
import { FIXTURE_SCENARIO } from "../__fixtures__/scenario";
import type { HostSpec } from "../net/types";
import { createInitialState } from "./scenario";
import { ScenarioError } from "./scenario-error";
import type { ScenarioSpec } from "./types";

const host = (overrides: Partial<HostSpec> = {}): HostSpec => ({
  id: "box",
  hostname: "box",
  interfaces: [{ ip: "10.9.0.5", subnet: "10.9.0.0/24" }],
  os: { family: "linux", name: "Linux" },
  users: [{ name: "learner", uid: 1000 }],
  fs: {},
  ...overrides,
});

const scenario = (overrides: Partial<ScenarioSpec> = {}): ScenarioSpec => ({
  id: "tiny",
  network: { hosts: [host()] },
  session: { host: "box", user: "learner" },
  ...overrides,
});

/** The problems a malformed scenario reports. */
function problemsOf(spec: ScenarioSpec): readonly string[] {
  try {
    createInitialState(spec, 1);
  } catch (error) {
    if (error instanceof ScenarioError) return error.problems;
    throw error;
  }
  throw new Error("expected the scenario to be rejected");
}

describe("createInitialState", () => {
  it("starts the learner in their home folder, knowing only their own machine", () => {
    const state = createInitialState(FIXTURE_SCENARIO, 5);
    expect(state.tick).toBe(0);
    expect(state.seed).toBe(5);
    expect(state.session).toMatchObject({ hostId: "ws-01", user: "recruit", cwd: "/home/recruit" });
    expect(state.session.env).toMatchObject({ HOME: "/home/recruit", USER: "recruit" });
    expect(Object.keys(state.discovery.hosts)).toEqual(["ws-01"]);
    expect(state.discovery.hosts["ws-01"]).toMatchObject({
      accessed: true,
      portScanned: false,
      via: "session",
    });
    expect(state.flagsFound).toEqual([]);
  });

  it("only gives filesystems to hosts that define one", () => {
    expect(Object.keys(createInitialState(FIXTURE_SCENARIO, 1).machines)).toEqual(["ws-01"]);
  });

  it("puts hosts from the briefing on the map from the start", () => {
    const state = createInitialState({ ...FIXTURE_SCENARIO, knownHosts: ["web-01"] }, 1);
    expect(state.discovery.hosts["web-01"]).toMatchObject({
      via: "briefing",
      portScanned: false,
      ips: ["10.0.1.20"],
    });
    expect(state.discovery.hosts["web-01"]?.services).toEqual({});
  });

  it("falls back to / when the user's home doesn't exist", () => {
    const state = createInitialState(
      scenario({ network: { hosts: [host({ fs: { base: "empty" } })] } }),
      1,
    );
    expect(state.session.cwd).toBe("/");
  });

  it("is frozen", () => {
    expect(Object.isFrozen(createInitialState(FIXTURE_SCENARIO, 1).network.hosts)).toBe(true);
  });

  it("reports every problem at once, readably", () => {
    const problems = problemsOf(
      scenario({
        id: "Bad Id",
        network: {
          hosts: [
            host({
              id: "a",
              hostname: "files.intranet",
              interfaces: [{ ip: "100.64.0.9", subnet: "100.64.0.0/24" }],
            }),
            host({
              id: "a",
              interfaces: [{ ip: "10.9.0.5", subnet: "10.9.1.0/24" }],
              reachableFrom: ["nobody-here"],
            }),
          ],
        },
        session: { host: "missing", user: "learner" },
      }),
    );
    expect(problems.join("\n")).toMatch(/must be one word or end in a reserved domain/);
    expect(problems.join("\n")).toMatch(/100\.64\.0\.9 is outside the reserved ranges/);
    expect(problems.join("\n")).toMatch(/"a" is defined twice/);
    expect(problems.join("\n")).toMatch(/10\.9\.0\.5 is not inside 10\.9\.1\.0\/24/);
    expect(problems.join("\n")).toMatch(/"nobody-here" is not "\*", a host id, or a network range/);
  });

  it.each<[string, Partial<ScenarioSpec>, RegExp]>([
    ["a bad id", { id: "Not OK" }, /id "Not OK"/],
    [
      "a session host without a filesystem",
      { network: { hosts: [host({ fs: undefined, users: undefined })] } },
      /needs a filesystem/,
    ],
    [
      "an unknown session user",
      { session: { host: "box", user: "ghost" } },
      /session user "ghost"/,
    ],
    [
      "a cwd that doesn't exist",
      { session: { host: "box", user: "learner", cwd: "/nope" } },
      /session cwd "\/nope"/,
    ],
    ["an unknown known host", { knownHosts: ["nope"] }, /knownHosts: "nope"/],
    [
      "duplicate flags",
      {
        flags: [
          { id: "f", token: "SIM{a}" },
          { id: "f", token: "SIM{b}" },
        ],
      },
      /flag "f" is listed twice/,
    ],
    ["a tiny flag token", { flags: [{ id: "f", token: "x" }] }, /token of at least 4/],
    ["a zone-less start time", { startTime: "2026-03-02T09:00:00" }, /startTime/],
  ])("rejects %s", (_, overrides, pattern) => {
    expect(problemsOf(scenario(overrides)).join("\n")).toMatch(pattern);
  });

  it("rejects a service port out of range and duplicate ports", () => {
    const service = {
      port: 70_000,
      protocol: "tcp",
      name: "web",
      product: "p",
      version: "1",
    } as const;
    const problems = problemsOf(
      scenario({
        network: {
          hosts: [
            host({ services: [service, { ...service, port: 22 }, { ...service, port: 22 }] }),
          ],
        },
      }),
    );
    expect(problems.join("\n")).toMatch(/port 70000 must be 1-65535/);
    expect(problems.join("\n")).toMatch(/22\/tcp is defined twice/);
  });
});
