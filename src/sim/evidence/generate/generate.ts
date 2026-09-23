import { createRng } from "../../core/rng";
import { hashHex } from "../hash";
import { imageBytes } from "../image";
import { formatRef } from "../refs";
import { isKnownZone } from "../time";
import type { DiskImage, EvidenceSet, Instant, LogRecord, LogSource, MemoryImage } from "../types";
import { applyAction } from "./actions";
import { planNoise } from "./noise";
import { freezeDisk } from "./snapshot";
import {
  GenerateError,
  type CaseSpec,
  type GenerateResult,
  type PendingArtefact,
  type StoryAction,
  type TracedArtefact,
  type TraceEntry,
} from "./types";
import { createWorld, machineOf, type World } from "./world";

/**
 * Story to evidence (docs/plan/03-case-format-and-generator.md §Generator).
 *
 * Build the clean machines from their baselines, work out the benign activity around the story,
 * merge the two in time order, play every action, and freeze what is left into an `EvidenceSet`.
 * Pure and seeded: the same case always produces byte-identical evidence, which is what lets
 * `pnpm evidence:check` tell a story edit from a generator bug.
 *
 * Along with the evidence it returns a **trace**: every action and the artefacts it left. That is
 * what the consistency and answer-integrity tests read, and it is the only reason a story edit
 * can be caught the moment it stops agreeing with the evidence.
 */

const HOUR = 3_600_000;

export function generate(spec: CaseSpec): GenerateResult {
  if (spec.story.length === 0) {
    throw new GenerateError("a case needs at least one story action.", spec.id);
  }
  if (spec.machines.length === 0) {
    throw new GenerateError("a case needs at least one machine.", spec.id);
  }

  const rng = createRng(spec.seed);
  const times = spec.story.map((action) => action.at);
  const startsAt = Math.min(...times);
  const endsAt = Math.max(...times);
  const world = createWorld(spec, rng, startsAt);

  const noise = planNoise(
    spec.noise,
    [...world.machines.values()],
    { from: startsAt - 2 * HOUR, to: endsAt + 2 * HOUR, stops: handoverTimes(spec) },
    rng,
  );

  const trace: TraceEntry[] = [];
  const pending: PendingArtefact[][] = [];
  for (const { action, source, position } of merge(spec.story, noise)) {
    const index = trace.length;
    const artefacts: PendingArtefact[] = [];
    pending.push(artefacts);
    trace.push({
      index,
      ...(action.id === undefined ? {} : { id: action.id }),
      do: action.do,
      at: action.at,
      on: action.on,
      source,
      artefacts: [],
    });
    play(world, action, index, `${source}[${position}] ${action.do} on ${action.on}`, pending);
  }

  return finish(spec, world, trace, pending);
}

/** The evidence on its own, for callers that don't need the trace. */
export function generateEvidence(spec: CaseSpec): EvidenceSet {
  return generate(spec).evidence;
}

// ---------------------------------------------------------------------------------------------
// Playing the story

interface Scheduled {
  readonly action: StoryAction;
  readonly source: "story" | "noise";
  /** Its position in the story (or the noise), for a message an author can find. */
  readonly position: number;
}

/**
 * Story and noise in one list, in time order. Two things at the same instant keep the order they
 * were written in, and a story action always goes before a noise action, so a story never depends
 * on where the seeded noise happened to land.
 */
function merge(story: readonly StoryAction[], noise: readonly StoryAction[]): Scheduled[] {
  const all: Scheduled[] = [
    ...story.map((action, position) => ({ action, source: "story" as const, position })),
    ...noise.map((action, position) => ({ action, source: "noise" as const, position })),
  ];
  return all
    .map((item, order) => ({ item, order }))
    .sort(
      (a, b) =>
        a.item.action.at - b.item.action.at ||
        rank(a.item.source) - rank(b.item.source) ||
        a.order - b.order,
    )
    .map(({ item }) => item);
}

const rank = (source: "story" | "noise"): number => (source === "story" ? 0 : 1);

function play(
  world: World,
  action: StoryAction,
  index: number,
  where: string,
  pending: PendingArtefact[][],
): void {
  const machine = machineOf(world, action.on, where);
  const recorded = action.at + machine.skewMinutes * 60_000;
  const noteAt = (where: number, artefact: PendingArtefact): void => {
    pending[where]?.push(artefact);
  };

  applyAction(
    {
      world,
      machine,
      action,
      at: action.at,
      recorded,
      index,
      rng: world.rng,
      where,
      log(source, fields, options = {}) {
        const key = world.nextLogKey++;
        const at = options.at ?? recorded;
        world.logs.push({
          key,
          source,
          at,
          host: options.host ?? machine.id,
          ...(options.eventId === undefined ? {} : { eventId: options.eventId }),
          fields,
        });
        noteAt(index, {
          kind: "log",
          key,
          at,
          what:
            options.what ??
            `${source}${options.eventId === undefined ? "" : ` ${options.eventId}`}`,
        });
      },
      note: (artefact) => noteAt(index, artefact),
      noteFor: (origin, artefact) => {
        if (origin >= 0) noteAt(origin, artefact);
      },
      fail(message) {
        throw new GenerateError(message, where);
      },
    },
    action,
  );
}

// ---------------------------------------------------------------------------------------------
// Freezing what the story left

function finish(
  spec: CaseSpec,
  world: World,
  trace: TraceEntry[],
  pending: PendingArtefact[][],
): GenerateResult {
  const disks = keptDisks(spec, world);
  const memory = keptMemory(spec, world);
  const { logs, seqOf, droppedSources } = keptLogs(spec, world);

  checkHandover(world, disks);

  const keptDiskIds = new Set(disks.map((disk) => disk.id));
  const keptMemoryIds = new Set(memory.map((image) => image.id));
  const resolved: TraceEntry[] = trace.map((entry, index) => ({
    ...entry,
    artefacts: (pending[index] ?? [])
      .map((artefact) => toTraced(artefact, seqOf, keptDiskIds, keptMemoryIds))
      .filter((artefact): artefact is TracedArtefact => artefact !== undefined),
  }));

  const zones = spec.evidence.zones ?? {};
  for (const [source, zone] of Object.entries(zones)) {
    if (zone !== undefined && !isKnownZone(zone)) {
      throw new GenerateError(
        `the offset table has no zone "${zone}". Add it to src/sim/evidence/time.ts, or use UTC.`,
        `evidence.zones.${source}`,
      );
    }
  }

  const evidence: EvidenceSet = {
    caseId: spec.id,
    seed: spec.seed,
    disks,
    memory,
    logs,
    zones,
    handover: world.handover,
  };
  return { evidence, trace: resolved, droppedSources };
}

function keptDisks(spec: CaseSpec, world: World): DiskImage[] {
  return spec.evidence.disks.map((id) => {
    const disk = world.disks.get(id);
    if (!disk) {
      const machine = world.machines.get(id);
      if (machine && !machine.baseline.imaged) {
        throw new GenerateError(
          `${id} is built from ${machine.baseline.id}, which is never imaged: it is where evidence is examined, not evidence itself. Take it out of evidence.disks.`,
          "evidence.disks",
        );
      }
      throw new GenerateError(
        `there is no disk image called "${id}". The images in this case are: ${[...world.disks.keys()].join(", ") || "none"}.`,
        "evidence.disks",
      );
    }
    return freezeDisk(disk);
  });
}

function keptMemory(spec: CaseSpec, world: World): MemoryImage[] {
  const wanted = new Set(spec.evidence.memory);
  for (const id of wanted) {
    if (!world.memory.some((image) => image.id === id || image.host === id)) {
      throw new GenerateError(
        `nothing captured the memory of "${id}". Add a capture-memory action on it, or take it out of evidence.memory.`,
        "evidence.memory",
      );
    }
  }
  return world.memory.filter((image) => wanted.has(image.id) || wanted.has(image.host));
}

interface KeptLogs {
  readonly logs: LogRecord[];
  /** Where each pending record ended up, so the trace can name it. */
  readonly seqOf: Map<number, { source: LogSource; seq: number }>;
  readonly droppedSources: LogSource[];
}

/**
 * The records the case hands over, numbered. Sequence numbers are given out per source in time
 * order (oldest first), so `log:security/1` is always the first security record in the case,
 * whichever action happened to write it.
 */
function keptLogs(spec: CaseSpec, world: World): KeptLogs {
  const allowed = new Set<LogSource>(spec.evidence.logs);
  const dropped = new Set<LogSource>();
  const kept = world.logs.filter((record) => {
    if (allowed.has(record.source)) return true;
    dropped.add(record.source);
    return false;
  });

  const seqOf = new Map<number, { source: LogSource; seq: number }>();
  const logs: LogRecord[] = [];
  for (const source of [...allowed].sort()) {
    const ofSource = kept
      .filter((record) => record.source === source)
      .sort((a, b) => a.at - b.at || a.key - b.key);
    ofSource.forEach((record, index) => {
      const seq = index + 1;
      seqOf.set(record.key, { source, seq });
      logs.push({
        seq,
        source,
        at: record.at,
        host: record.host,
        ...(record.eventId === undefined ? {} : { eventId: record.eventId }),
        fields: record.fields,
      });
    });
  }
  logs.sort((a, b) => a.at - b.at || compare(a.source, b.source) || a.seq - b.seq);
  return { logs, seqOf, droppedSources: [...dropped].sort() };
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function toTraced(
  artefact: PendingArtefact,
  seqOf: Map<number, { source: LogSource; seq: number }>,
  disks: ReadonlySet<string>,
  memory: ReadonlySet<string>,
): TracedArtefact | undefined {
  const { at, what } = artefact;
  switch (artefact.kind) {
    case "log": {
      const found = seqOf.get(artefact.key);
      return found
        ? { ref: formatRef({ kind: "log", source: found.source, seq: found.seq }), at, what }
        : undefined;
    }
    case "file":
      return disks.has(artefact.image)
        ? {
            ref: formatRef({ kind: "file", image: artefact.image, record: artefact.record }),
            at,
            what,
          }
        : undefined;
    case "carve":
      return disks.has(artefact.image)
        ? {
            ref: formatRef({ kind: "carve", image: artefact.image, offset: artefact.offset }),
            at,
            what,
          }
        : undefined;
    case "process":
      return memory.has(artefact.image)
        ? {
            ref: formatRef({ kind: "process", image: artefact.image, pid: artefact.pid }),
            at,
            what,
          }
        : undefined;
    case "connection":
      return memory.has(artefact.image)
        ? {
            ref: formatRef({ kind: "connection", image: artefact.image, index: artefact.index }),
            at,
            what,
          }
        : undefined;
    case "region":
      return memory.has(artefact.image)
        ? {
            ref: formatRef({ kind: "region", image: artefact.image, base: artefact.base }),
            at,
            what,
          }
        : undefined;
  }
}

/**
 * The hash on a handover form has to still be the hash of the image. A story that changes a disk
 * after signing for it is a story bug, and a quiet one: Case 1's whole lesson is that the player's
 * own careless read is what breaks this, not the story's.
 */
function checkHandover(world: World, disks: readonly DiskImage[]): void {
  for (const [item, signed] of world.handoverHashes) {
    const disk = disks.find((image) => image.id === item);
    if (!disk) continue;
    const now = hashHex("sha256", imageBytes(disk));
    if (now !== signed) {
      throw new GenerateError(
        `the disk ${item} changed after it was handed over, so the hashes on the form no longer match it. Move the hand-over action after everything that touches ${item}.`,
        "story",
      );
    }
  }
}

/**
 * When each machine was handed over, so nothing else happens on it afterwards. A machine that is
 * in an evidence bag is not one anybody is still saving documents on.
 */
function handoverTimes(spec: CaseSpec): Map<string, Instant> {
  const stops = new Map<string, Instant>();
  for (const action of spec.story) {
    if (action.do !== "hand-over") continue;
    const item = action.item ?? action.on;
    const already = stops.get(item);
    if (already === undefined || action.at < already) stops.set(item, action.at);
  }
  return stops;
}

/** Only exported for the tests: the window noise is generated over. */
export function noiseWindow(story: readonly StoryAction[]): { from: Instant; to: Instant } {
  const times = story.map((action) => action.at);
  return { from: Math.min(...times) - 2 * HOUR, to: Math.max(...times) + 2 * HOUR };
}
