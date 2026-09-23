import { describe, expect, it } from "vitest";
import { decodeBase64 } from "../../base64";
import { at, play, tracedBy } from "../__fixtures__/case";

const WHEN = at("2026-04-11T19:48:00Z");

const story = [
  {
    id: "written-into",
    at: WHEN,
    actor: { kind: "attacker" } as const,
    on: "qf-lt-07",
    do: "inject" as const,
    into: "svchost.exe",
    preview: "beacon: cdn-sync.example",
  },
  {
    at: WHEN + 60_000,
    actor: { kind: "analyst" } as const,
    on: "qf-lt-07",
    do: "capture-memory" as const,
  },
];

describe("inject", () => {
  it("leaves a writable, executable region backed by no file at all", () => {
    const { evidence } = play(story, { memory: ["qf-lt-07"] });
    const image = evidence.memory[0];
    const region = image?.regions[0];
    const host = image?.processes.find((process) => process.pid === region?.pid);

    expect(host?.name).toBe("svchost.exe");
    expect(region?.protection).toBe("PAGE_EXECUTE_READWRITE");
    expect(region?.backedBy).toBeUndefined();
    expect(new TextDecoder().decode(decodeBase64(region?.previewB64 ?? ""))).toContain(
      "cdn-sync.example",
    );
  });

  it("credits the region to the action that wrote it, not to the capture", () => {
    const result = play(story, { memory: ["qf-lt-07"] });
    const base = result.evidence.memory[0]?.regions[0]?.base ?? 0;
    expect(tracedBy(result, "written-into")).toEqual([`mem:qf-lt-07-mem:vad/${base}`]);
  });

  it("refuses a process that isn't running", () => {
    expect(() =>
      play([
        { at: WHEN, actor: { kind: "attacker" }, on: "qf-lt-07", do: "inject", into: "ghost.exe" },
      ]),
    ).toThrow(/no process called "ghost.exe"/);
  });
});
