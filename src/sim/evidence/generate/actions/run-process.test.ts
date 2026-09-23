import { describe, expect, it } from "vitest";
import { at, oneLog, play, recordAt } from "../__fixtures__/case";

const WHEN = at("2026-04-11T19:47:00Z");

const run = {
  at: WHEN,
  actor: { kind: "attacker" } as const,
  on: "qf-lt-07",
  do: "run-process" as const,
  name: "dispatch-sync.exe",
  path: "C:\\Users\\Public\\Downloads\\dispatch-sync.exe",
  cmdline: "dispatch-sync.exe --quiet",
  user: "dana",
};

describe("run-process", () => {
  it("records the same start in both sources, with the parent and command line", () => {
    const { evidence } = play([run]);

    const created = oneLog(evidence, "security", 4688);
    expect(created.fields.NewProcessName).toBe(run.path);
    expect(created.fields.CommandLine).toBe("dispatch-sync.exe --quiet");
    expect(created.fields.ParentProcessName).toBe("C:\\Windows\\explorer.exe");

    const monitored = oneLog(evidence, "sysmon-lite", 1);
    expect(monitored.fields.Image).toBe(run.path);
    expect(monitored.fields.User).toBe("dana");
    expect(monitored.at).toBe(WHEN);
  });

  it("puts the program on the disk, so a running process has a file to look at", () => {
    const { evidence } = play([run]);
    expect(recordAt(evidence, run.path).kind).toBe("file");
  });

  it("shows up in a memory capture, unlinked when the story says so", () => {
    const { evidence } = play(
      [
        { ...run, unlinked: true },
        { at: WHEN + 60_000, actor: { kind: "analyst" }, on: "qf-lt-07", do: "capture-memory" },
      ],
      { memory: ["qf-lt-07"] },
    );

    const found = evidence.memory[0]?.processes.find((p) => p.name === "dispatch-sync.exe");
    expect(found?.unlinked).toBe(true);
    expect(found?.createdAt).toBe(WHEN);
  });

  it("refuses two processes on one pid", () => {
    expect(() =>
      play([
        { ...run, pid: 1234 },
        { ...run, at: WHEN + 1000, pid: 1234 },
      ]),
    ).toThrow(/pid 1234 is already a process/);
  });
});
