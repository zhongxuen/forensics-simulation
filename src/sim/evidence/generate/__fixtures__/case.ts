import { parseInstant } from "../../../core/clock";
import { resolveRef } from "../../refs";
import type { EvidenceSet, FileRecord, Instant, LogRecord, LogSource } from "../../types";
import { generate } from "../generate";
import type { CaseSpec, GenerateResult, MachineSpec, StoryAction } from "../types";

/**
 * A tiny case to hang an action test on. Each action in `../actions` has its own test, and every
 * one of them plays a one- or two-line story through the real `generate`, so what it checks is the
 * evidence a player would see rather than the generator's insides.
 *
 * Not the test builder (`src/sim/evidence/builder.ts`): that makes evidence up, this makes it the
 * way a case does.
 */

/** "2026-04-11T19:42:03Z" as an instant. Throws on anything ambiguous, like the case schema does. */
export function at(iso: string): Instant {
  const ms = parseInstant(iso);
  if (ms === undefined) throw new RangeError(`not a time with a zone: ${iso}`);
  return ms;
}

export const LAPTOP: MachineSpec = {
  id: "qf-lt-07",
  kind: "windows-laptop",
  baseline: "office-laptop-v1",
  zone: "Europe/London",
  ip: "10.60.0.27",
  accounts: ["dana"],
};

export const SERVER: MachineSpec = {
  id: "qf-srv-01",
  kind: "windows-server",
  baseline: "office-server-v1",
  zone: "Europe/London",
  ip: "10.60.1.10",
};

export const TRAINING_LAPTOP: MachineSpec = {
  id: "train-lt-01",
  kind: "windows-laptop",
  baseline: "training-laptop-v1",
  zone: "Europe/London",
  accounts: ["trainee"],
};

export const WORKSTATION: MachineSpec = {
  id: "ir-ws-01",
  kind: "linux-workstation",
  baseline: "analyst-workstation-v1",
  zone: "Europe/London",
};

/** Every log source, so an action test never loses a record to the case's hand-over list. */
export const ALL_SOURCES: readonly LogSource[] = [
  "security",
  "sysmon-lite",
  "web-access",
  "firewall",
  "dns",
  "vpn",
];

export interface CaseOptions {
  readonly machines?: readonly MachineSpec[];
  readonly seed?: number;
  readonly disks?: readonly string[];
  readonly memory?: readonly string[];
  readonly logs?: readonly LogSource[];
  readonly noise?: CaseSpec["noise"];
  readonly zones?: CaseSpec["evidence"]["zones"];
}

export function caseOf(story: readonly StoryAction[], options: CaseOptions = {}): CaseSpec {
  const machines = options.machines ?? [LAPTOP];
  return {
    id: "_test",
    seed: options.seed ?? 7,
    machines,
    story,
    ...(options.noise ? { noise: options.noise } : {}),
    evidence: {
      disks:
        options.disks ?? machines.filter((m) => m.kind !== "linux-workstation").map((m) => m.id),
      logs: options.logs ?? ALL_SOURCES,
      memory: options.memory ?? [],
      ...(options.zones ? { zones: options.zones } : {}),
    },
  };
}

/** Plays a story and hands back everything it left. */
export function play(story: readonly StoryAction[], options: CaseOptions = {}): GenerateResult {
  return generate(caseOf(story, options));
}

// ---------------------------------------------------------------------------------------------
// Reading the result

/** The records at `path` on a disk, live first, then deleted. Windows paths ignore case. */
export function recordsAt(evidence: EvidenceSet, path: string, image?: string): FileRecord[] {
  const disk = image === undefined ? evidence.disks[0] : evidence.disks.find((d) => d.id === image);
  const key = path.toLowerCase();
  const found = (disk?.records ?? []).filter((record) => record.path.toLowerCase() === key);
  return [...found.filter((r) => !r.deleted), ...found.filter((r) => r.deleted)];
}

/** The one record at `path`. Fails loudly, so a test that meant to find one doesn't pass quietly. */
export function recordAt(evidence: EvidenceSet, path: string, image?: string): FileRecord {
  const found = recordsAt(evidence, path, image)[0];
  if (!found) throw new Error(`no record at ${path}`);
  return found;
}

export function logsOf(evidence: EvidenceSet, source: LogSource, eventId?: number): LogRecord[] {
  return evidence.logs.filter(
    (record) => record.source === source && (eventId === undefined || record.eventId === eventId),
  );
}

/** The one record of that source and event id. */
export function oneLog(evidence: EvidenceSet, source: LogSource, eventId?: number): LogRecord {
  const found = logsOf(evidence, source, eventId);
  if (found.length !== 1) {
    throw new Error(
      `expected one ${source}${eventId === undefined ? "" : ` ${eventId}`} record, found ${found.length}`,
    );
  }
  return found[0] as LogRecord;
}

/** Everything one story action left behind, by its `id:` in the story. */
export function tracedBy(result: GenerateResult, id: string): readonly string[] {
  const entry = result.trace.find((item) => item.id === id);
  if (!entry) throw new Error(`no story action with the id "${id}"`);
  return entry.artefacts.map((artefact) => artefact.ref);
}

/** Every ref a run traced, which should all still point at something. */
export function everyTracedRef(result: GenerateResult): string[] {
  return result.trace.flatMap((entry) => entry.artefacts.map((artefact) => artefact.ref));
}

export { resolveRef };
