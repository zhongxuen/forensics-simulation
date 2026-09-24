import { describe, expect, it } from "vitest";
import { resolveRef } from "@/sim";
import { buildTimeline, macbKind, type TimelineEntry } from "@/sim/evidence/timeline";
import type { EvidenceSet } from "@/sim/types";
import { catalog, committedEvidence } from "./support";

/**
 * The super-timeline over every case's evidence as it ships (docs/plan/09-timeline.md §Done when):
 * every entry's `at` is exactly the instant on the artefact its ref resolves to, and nothing with
 * a time is left off. The model's own tests prove the same over random evidence; this proves it
 * over what the generator really writes.
 */
function atProblems(set: EvidenceSet, entry: TimelineEntry): string | undefined {
  const found = resolveRef(set, entry.ref);
  const label = `${entry.ref} ${entry.kind}`;
  if (!found) return `${label}: resolves to nothing`;
  switch (found.kind) {
    case "file":
      return entry.kind === macbKind(found.file.times, entry.at)
        ? undefined
        : `${label}: the record's times give ${macbKind(found.file.times, entry.at)} at ${entry.at}`;
    case "process":
      return entry.at === found.process.createdAt ? undefined : `${label}: not its start time`;
    case "connection":
      return entry.at === found.connection.createdAt ? undefined : `${label}: not its creation`;
    case "log":
      return entry.at === found.record.at ? undefined : `${label}: not the record's time`;
    default:
      return `${label}: a ${found.kind} has no time of its own`;
  }
}

const cases = catalog.all.flatMap((entry) => {
  const set = committedEvidence(entry.id);
  return set ? [[entry.id, set] as const] : [];
});

describe.each(cases)("the timeline of %s", (_id, set) => {
  const entries = buildTimeline(set);

  it("puts every entry at exactly the instant on the artefact its ref resolves to", () => {
    expect(entries.flatMap((entry) => atProblems(set, entry) ?? [])).toEqual([]);
  });

  it("leaves nothing with a time off", () => {
    let expected = set.logs.length;
    for (const disk of set.disks) {
      for (const file of disk.records) expected += new Set(Object.values(file.times)).size;
    }
    for (const image of set.memory) expected += image.processes.length + image.connections.length;
    expect(entries).toHaveLength(expected);
  });
});

it("has committed evidence to check", () => {
  expect(cases.length).toBeGreaterThan(0);
});
