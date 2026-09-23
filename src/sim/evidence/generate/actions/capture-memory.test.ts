import { describe, expect, it } from "vitest";
import { at, play } from "../__fixtures__/case";

const START = at("2026-04-11T19:47:00Z");
const CAPTURED = at("2026-04-11T20:10:00Z");

const started = {
  at: START,
  actor: { kind: "attacker" } as const,
  on: "qf-lt-07",
  do: "run-process" as const,
  name: "dispatch-sync.exe",
  cmdline: "dispatch-sync.exe --host cdn-sync.example",
};

const connected = {
  at: START + 30_000,
  actor: { kind: "attacker" } as const,
  on: "qf-lt-07",
  do: "connect" as const,
  remote: "203.0.113.47:443",
};

const captured = {
  at: CAPTURED,
  actor: { kind: "analyst" } as const,
  on: "qf-lt-07",
  do: "capture-memory" as const,
};

const story = [started, connected, captured];

describe("capture-memory", () => {
  it("photographs what the machine is holding, at the moment it was taken", () => {
    const { evidence } = play(story, { memory: ["qf-lt-07"] });
    const image = evidence.memory[0];

    expect(image?.id).toBe("qf-lt-07-mem");
    expect(image?.host).toBe("qf-lt-07");
    expect(image?.capturedAt).toBe(CAPTURED);
    expect(image?.processes.map((process) => process.name)).toContain("dispatch-sync.exe");
    expect(image?.connections[0]?.remote).toBe("203.0.113.47:443");
  });

  it("holds the readable text a strings run would find", () => {
    const { evidence } = play(story, { memory: ["qf-lt-07"] });
    const values = evidence.memory[0]?.strings.map((found) => found.value) ?? [];

    expect(values).toContain("dispatch-sync.exe --host cdn-sync.example");
    expect(values).toContain("203.0.113.47:443");
    expect(new Set(evidence.memory[0]?.strings.map((s) => s.offset)).size).toBe(values.length);
  });

  it("takes the id the story gives it, and refuses two captures with one id", () => {
    const { evidence } = play([{ ...captured, id: "qf-lt-07-first" }], {
      memory: ["qf-lt-07-first"],
    });
    expect(evidence.memory[0]?.id).toBe("qf-lt-07-first");

    expect(() =>
      play([captured, { ...captured, at: CAPTURED + 1000 }], { memory: ["qf-lt-07"] }),
    ).toThrow(/already a memory capture/);
  });
});
