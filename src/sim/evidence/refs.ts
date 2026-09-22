import { base64ByteLength } from "./base64";
import {
  LOG_SOURCES,
  type ArtefactRef,
  type EvidenceSet,
  type LogSource,
  type ParsedRef,
  type ResolvedArtefact,
} from "./types";

/**
 * Artefact refs (docs/plan/02-evidence-model.md §Artefact refs): one stable string per piece of
 * evidence a player can point at. `formatRef` and `parseRef` round-trip exactly: every ref has one
 * spelling (decimal numbers, no leading zeros), so refs can be compared as strings.
 */

/** Image ids: no colons or slashes, so a ref splits one way only. */
const IMAGE_ID = /^[a-z0-9][a-z0-9._-]*$/;
const NUMBER = "(0|[1-9][0-9]*)";
const IMAGE = "([a-z0-9][a-z0-9._-]*)";

const DISK_REF = new RegExp(`^disk:${IMAGE}:(mft|carve)/${NUMBER}$`);
const MEM_REF = new RegExp(`^mem:${IMAGE}:(pid|conn|vad)/${NUMBER}$`);
const LOG_REF = new RegExp(`^log:([a-z-]+)/${NUMBER}$`);

const MEM_KINDS = { pid: "process", conn: "connection", vad: "region" } as const;

/** True when `id` can be used as a disk or memory image id in a ref. */
export function isImageId(id: string): boolean {
  return IMAGE_ID.test(id);
}

export function isLogSource(value: string): value is LogSource {
  return (LOG_SOURCES as readonly string[]).includes(value);
}

/** Takes a ref apart, or returns undefined if `ref` isn't one. */
export function parseRef(ref: string): ParsedRef | undefined {
  let match = DISK_REF.exec(ref);
  if (match) {
    const [, image = "", kind, digits = ""] = match;
    const n = toNumber(digits);
    if (n === undefined) return undefined;
    return kind === "mft"
      ? { kind: "file", image, record: n }
      : { kind: "carve", image, offset: n };
  }
  match = MEM_REF.exec(ref);
  if (match) {
    const [, image = "", kind = "", digits = ""] = match;
    const n = toNumber(digits);
    if (n === undefined) return undefined;
    switch (MEM_KINDS[kind as keyof typeof MEM_KINDS]) {
      case "process":
        return { kind: "process", image, pid: n };
      case "connection":
        return { kind: "connection", image, index: n };
      case "region":
        return { kind: "region", image, base: n };
    }
  }
  match = LOG_REF.exec(ref);
  if (match) {
    const [, source = "", digits = ""] = match;
    const n = toNumber(digits);
    if (n === undefined || !isLogSource(source)) return undefined;
    return { kind: "log", source, seq: n };
  }
  return undefined;
}

export function isArtefactRef(value: unknown): value is ArtefactRef {
  return typeof value === "string" && parseRef(value) !== undefined;
}

/** Builds the one spelling of a ref. Throws a RangeError for an id or number that can't be one. */
export function formatRef(parsed: ParsedRef): ArtefactRef {
  if (parsed.kind === "log") {
    if (!isLogSource(parsed.source)) throw new RangeError(`not a log source: ${parsed.source}`);
    return `log:${parsed.source}/${checkNumber(parsed.seq)}`;
  }
  if (!isImageId(parsed.image)) throw new RangeError(`not an image id: "${parsed.image}"`);
  const image = parsed.image;
  switch (parsed.kind) {
    case "file":
      return `disk:${image}:mft/${checkNumber(parsed.record)}`;
    case "carve":
      return `disk:${image}:carve/${checkNumber(parsed.offset)}`;
    case "process":
      return `mem:${image}:pid/${checkNumber(parsed.pid)}`;
    case "connection":
      return `mem:${image}:conn/${checkNumber(parsed.index)}`;
    case "region":
      return `mem:${image}:vad/${checkNumber(parsed.base)}`;
  }
}

/**
 * Finds what a ref points at in `evidence`, or undefined if it points at nothing (or isn't a ref).
 * A carve ref resolves to its disk and offset when the offset is inside the unallocated space;
 * what lies there is for the carver (file 07) to say.
 */
export function resolveRef(evidence: EvidenceSet, ref: string): ResolvedArtefact | undefined {
  const parsed = parseRef(ref);
  if (!parsed) return undefined;
  switch (parsed.kind) {
    case "file": {
      const disk = evidence.disks.find((d) => d.id === parsed.image);
      const file = disk?.records.find((r) => r.record === parsed.record);
      return disk && file ? { kind: "file", disk, file } : undefined;
    }
    case "carve": {
      const disk = evidence.disks.find((d) => d.id === parsed.image);
      if (!disk || parsed.offset >= base64ByteLength(disk.unallocatedB64)) return undefined;
      return { kind: "carve", disk, offset: parsed.offset };
    }
    case "process": {
      const image = evidence.memory.find((m) => m.id === parsed.image);
      const process = image?.processes.find((p) => p.pid === parsed.pid);
      return image && process ? { kind: "process", image, process } : undefined;
    }
    case "connection": {
      const image = evidence.memory.find((m) => m.id === parsed.image);
      const connection = image?.connections[parsed.index];
      return image && connection
        ? { kind: "connection", image, index: parsed.index, connection }
        : undefined;
    }
    case "region": {
      const image = evidence.memory.find((m) => m.id === parsed.image);
      const region = image?.regions.find((r) => r.base === parsed.base);
      return image && region ? { kind: "region", image, region } : undefined;
    }
    case "log": {
      const record = evidence.logs.find((l) => l.source === parsed.source && l.seq === parsed.seq);
      return record ? { kind: "log", record } : undefined;
    }
  }
}

function toNumber(digits: string): number | undefined {
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : undefined;
}

function checkNumber(n: number): number {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`a ref number must be a non-negative safe integer, got ${n}`);
  }
  return n;
}
