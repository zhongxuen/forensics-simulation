"use client";

import { useMemo, useState } from "react";
import { TimelineView } from "@/features/timeline";
import type { EvidenceSet, TimelineEntry, TimelineSource } from "@/sim/types";

export interface TimelineBenchProps {
  readonly entries: number;
}

const SOURCES: readonly TimelineSource[] = [
  "disk",
  "memory",
  "security",
  "sysmon-lite",
  "firewall",
  "dns",
];

const START = Date.UTC(2026, 3, 11, 6, 0, 0);

/** A made-up evidence set: no records, only the zones, so the zone banner shows as in a case. */
const SET: EvidenceSet = {
  caseId: "timeline-bench",
  seed: 1,
  disks: [],
  memory: [],
  logs: [],
  zones: { disk: "Europe/London" },
  handover: [],
};

/**
 * `count` made-up moments across six sources and about a day, in the timeline's order. Bunched
 * the way real evidence is (busy minutes, quiet hours), and the same on every load.
 */
export function benchEntries(count: number): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let at = START;
  for (let i = 0; i < count; i += 1) {
    // Mostly a few seconds apart, with a long gap now and then.
    at += i % 97 === 0 ? 1_800_000 : ((i * 7919) % 23) * 1000;
    const source = SOURCES[(i * 31) % SOURCES.length] ?? "security";
    entries.push({
      at,
      source,
      kind: source === "disk" ? "M.C." : source === "memory" ? "process-start" : "4624",
      summary: `Made-up moment ${i + 1}, for measuring. SIMULATED.`,
      ref:
        source === "disk"
          ? `disk:bench:mft/${i}`
          : source === "memory"
            ? `mem:bench:pid/${i}`
            : `log:${source}/${i}`,
      host: "bench-01",
    });
  }
  return entries;
}

/**
 * The Timeline view with `entries` made-up moments. A measuring rig for
 * tests/e2e/timeline-performance.spec.ts, not a page anyone learns from. Pins are kept in this
 * page only. `data-bench-entries` says how many moments are drawn, so the test can wait for them.
 */
export function TimelineBench({ entries: count }: TimelineBenchProps) {
  const entries = useMemo(() => benchEntries(count), [count]);
  const [pins, setPins] = useState<readonly string[]>([]);
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6" data-bench-entries={entries.length}>
      <div>
        <h1 className="text-xl font-semibold text-primary">Timeline bench</h1>
        <p className="text-sm text-secondary">
          {entries.length} made-up moments. SIMULATED — not evidence from any case.
        </p>
      </div>
      <TimelineView
        set={SET}
        entries={entries}
        pins={pins}
        onPin={(ref) => setPins((previous) => [...previous, ref])}
        onUnpin={(ref) => setPins((previous) => previous.filter((pin) => pin !== ref))}
      />
    </div>
  );
}
