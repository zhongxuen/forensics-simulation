import { describe, expect, it } from "vitest";
import { at, caseOf, LAPTOP, SERVER, TRAINING_LAPTOP, WORKSTATION } from "../__fixtures__/case";
import { generate } from "../generate";
import type { MachineSpec, StoryAction } from "../types";
import { BASELINE_IDS, BASELINES, getBaseline } from "./index";

/**
 * The clean machine templates (docs/plan/03-case-format-and-generator.md §Generator). They are
 * data, so what is worth checking is that each one really does build a machine a story can act on,
 * and that they stay small: a case's evidence has to be something a beginner can read through, not
 * a filesystem dump.
 */

const START = at("2026-04-11T09:00:00Z");

const SPECS: Readonly<Record<string, MachineSpec>> = {
  "office-laptop-v1": LAPTOP,
  "office-server-v1": SERVER,
  "analyst-workstation-v1": WORKSTATION,
  "training-laptop-v1": TRAINING_LAPTOP,
};

/** Enough of a story to build the machine without touching it. */
const idle = (on: string): StoryAction[] => [
  { at: START, actor: { kind: "analyst" }, on, do: "capture-memory" },
];

describe("baselines", () => {
  it("registers each one under its own id", () => {
    for (const [id, baseline] of Object.entries(BASELINES)) expect(baseline.id).toBe(id);
    expect(BASELINE_IDS).toEqual([...BASELINE_IDS].sort());
    expect(getBaseline("nothing-like-this")).toBeUndefined();
  });

  it("has a machine in the test fixtures for every baseline", () => {
    expect(Object.keys(SPECS).sort()).toEqual([...BASELINE_IDS]);
  });

  it("builds a machine with files, accounts and processes on it", () => {
    for (const [id, spec] of Object.entries(SPECS)) {
      const baseline = getBaseline(id);
      const { evidence } = generate(
        caseOf(idle(spec.id), {
          machines: [spec],
          disks: baseline?.imaged ? [spec.id] : [],
          memory: [spec.id],
        }),
      );

      const image = evidence.memory[0];
      expect(image?.processes.length, id).toBeGreaterThan(1);
      // Every process's parent is either another process in the capture, or nothing at all.
      const pids = new Set(image?.processes.map((process) => process.pid));
      for (const process of image?.processes ?? []) {
        expect(process.ppid === 0 || pids.has(process.ppid), `${id}: ${process.name}`).toBe(true);
      }

      if (!baseline?.imaged) {
        expect(evidence.disks, id).toEqual([]);
        continue;
      }
      const disk = evidence.disks[0];
      expect(disk?.records.length, id).toBeGreaterThan(5);
      // Small on purpose: tens of files, not thousands.
      expect(disk?.records.length, id).toBeLessThan(120);
      expect(disk?.partitions.length, id).toBeGreaterThan(0);
      expect(disk?.device.serial, id).toMatch(/^[A-Z]{2}-\d{4}-\d{4}$/);
    }
  });

  it("gives every account a home folder, and every file a time before the story", () => {
    const { evidence } = generate(
      caseOf(idle("qf-lt-07"), { machines: [LAPTOP], memory: ["qf-lt-07"] }),
    );
    const disk = evidence.disks[0];

    expect(disk?.records.some((record) => record.path === "C:\\Users\\dana")).toBe(true);
    expect(disk?.records.some((record) => record.path === "C:\\Users\\Administrator")).toBe(true);
    for (const record of disk?.records ?? []) {
      expect(record.times.b, record.path).toBeLessThan(START);
      expect(record.deleted, record.path).toBe(false);
    }
  });

  it("puts a machine on its baseline's network when the case doesn't give it an address", () => {
    const { evidence } = generate(
      caseOf(
        [
          {
            at: START,
            actor: { kind: "system" },
            on: "qf-srv-01",
            do: "dns-query",
            query: "updates.example",
          },
        ],
        { machines: [{ ...SERVER, ip: undefined }] },
      ),
    );
    expect(evidence.logs[0]?.fields.client).toBe("10.60.1.10");
  });
});
