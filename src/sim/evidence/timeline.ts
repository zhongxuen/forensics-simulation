import { formatRef } from "./refs";
import { SECURITY_EVENTS, SYSMON_LITE_EVENTS, type EventInfo } from "./logs";
import {
  LOG_SOURCES,
  type ArtefactRef,
  type DiskImage,
  type EvidenceSet,
  type Instant,
  type LogRecord,
  type LogSource,
  type MacbTimes,
  type MemoryImage,
} from "./types";

/**
 * The super-timeline (docs/plan/09-timeline.md §The model): every moment in an evidence set, from
 * every source, in one ordered list. A file record gives up to four moments (its MACB times, merged
 * where they are equal), a memory image gives its process starts and connection creations, and a
 * log gives one moment per record.
 *
 * The order is total and never depends on the input's order: by instant, then by source (disk,
 * memory, then the logs in `LOG_SOURCES` order), then by ref, comparing the number at the end of a
 * ref as a number. So the same evidence always gives the same timeline, line for line.
 */

/** Where a moment came from. */
export type TimelineSource = "disk" | "memory" | LogSource;

/** Every source, in the order entries at the same instant are listed. */
export const TIMELINE_SOURCES: readonly TimelineSource[] = ["disk", "memory", ...LOG_SOURCES];

export interface TimelineEntry {
  /** UTC, always. Exactly the instant stored on the artefact `ref` points at. */
  readonly at: Instant;
  readonly source: TimelineSource;
  /**
   * What happened. For a file, its MACB letters with a dot for each time that is elsewhere
   * ("M.C.", "MACB", ".A.."). For memory, "process-start" or "connection". For a Windows-style
   * log, the event id ("4624"). For the other logs, the word the record leads with ("GET",
   * "block", "query", "connect").
   */
  readonly kind: string;
  /** One line, plain text: what a reader needs to recognise the moment. */
  readonly summary: string;
  readonly ref: ArtefactRef;
  /** The machine the moment happened on. */
  readonly host: string;
}

export const PROCESS_START = "process-start";
export const CONNECTION = "connection";

const MACB_KEYS: readonly (keyof MacbTimes)[] = ["m", "a", "c", "b"];

/** Every moment in `set`, ordered by instant, then source, then ref. */
export function buildTimeline(set: EvidenceSet): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const disk of set.disks) entries.push(...diskEntries(disk));
  for (const image of set.memory) entries.push(...memoryEntries(image));
  for (const record of set.logs) entries.push(logEntry(record));
  return entries.sort(compareEntries);
}

/** The timeline's order: instant, then source, then ref. */
export function compareEntries(x: TimelineEntry, y: TimelineEntry): number {
  return (
    x.at - y.at ||
    SOURCE_RANK[x.source] - SOURCE_RANK[y.source] ||
    compareRefs(x.ref, y.ref) ||
    compareText(x.kind, y.kind)
  );
}

const SOURCE_RANK = Object.fromEntries(TIMELINE_SOURCES.map((source, i) => [source, i])) as Record<
  TimelineSource,
  number
>;

/**
 * Refs in reading order: the text before the final number as text, then that number as a number,
 * so `mft/9` comes before `mft/42`. Never locale-dependent.
 */
export function compareRefs(x: string, y: string): number {
  const a = /^(.*?)(\d+)$/.exec(x);
  const b = /^(.*?)(\d+)$/.exec(y);
  if (a && b) return compareText(a[1] ?? "", b[1] ?? "") || Number(a[2]) - Number(b[2]);
  return compareText(x, y);
}

/**
 * The letters of the MACB times equal to `at`, in M, A, C, B order, with a dot for each of the
 * others: "M.C.". Four dots means none of the times is `at`.
 */
export function macbKind(times: MacbTimes, at: Instant): string {
  return MACB_KEYS.map((key) => (times[key] === at ? key.toUpperCase() : ".")).join("");
}

/** True for a kind `macbKind` wrote: four places, each its letter or a dot, at least one letter. */
export function isMacbKind(kind: string): boolean {
  return /^[M.][A.][C.][B.]$/.test(kind) && kind !== "....";
}

// ---------------------------------------------------------------------------------------------
// Disk

function diskEntries(disk: DiskImage): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const file of disk.records) {
    const ref = formatRef({ kind: "file", image: disk.id, record: file.record });
    // Folders end in a backslash, the way a listing shows them; the root has one already.
    const folder = file.kind === "dir" && !file.path.endsWith("\\");
    const summary = (folder ? `${file.path}\\` : file.path) + (file.deleted ? " (deleted)" : "");
    // One entry per distinct time, so equal times merge into one "M.C."-style entry.
    const seen = new Set<Instant>();
    for (const key of MACB_KEYS) {
      const at = file.times[key];
      if (seen.has(at)) continue;
      seen.add(at);
      entries.push({
        at,
        source: "disk",
        kind: macbKind(file.times, at),
        summary,
        ref,
        host: disk.id,
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------------------------
// Memory

function memoryEntries(image: MemoryImage): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const process of image.processes) {
    entries.push({
      at: process.createdAt,
      source: "memory",
      kind: PROCESS_START,
      summary: `${process.name} (pid ${process.pid}, parent ${process.ppid}) as ${process.user}: ${process.cmdline}`,
      ref: formatRef({ kind: "process", image: image.id, pid: process.pid }),
      host: image.host,
    });
  }
  image.connections.forEach((connection, index) => {
    const owner = image.processes.find((p) => p.pid === connection.pid);
    entries.push({
      at: connection.createdAt,
      source: "memory",
      kind: CONNECTION,
      summary:
        `${connection.proto} ${connection.local} -> ${connection.remote} ${connection.state}` +
        ` (${owner ? `${owner.name}, ` : ""}pid ${connection.pid})`,
      ref: formatRef({ kind: "connection", image: image.id, index }),
      host: image.host,
    });
  });
  return entries;
}

// ---------------------------------------------------------------------------------------------
// Logs

/** The fields that say the most about each Windows-style event, in the order they read best. */
const SUMMARY_FIELDS: Readonly<Record<string, readonly string[]>> = {
  "security/4624": ["TargetUserName", "LogonType", "IpAddress", "WorkstationName"],
  "security/4625": ["TargetUserName", "LogonType", "IpAddress", "WorkstationName"],
  "security/4634": ["TargetUserName", "LogonType"],
  "security/4672": ["SubjectUserName"],
  "security/4688": ["NewProcessName", "SubjectUserName", "ParentProcessName"],
  "security/4720": ["TargetUserName", "SubjectUserName"],
  "security/4732": ["MemberName", "TargetUserName", "SubjectUserName"],
  "sysmon-lite/1": ["Image", "User", "ParentImage"],
  "sysmon-lite/3": ["Image", "DestinationIp", "DestinationPort"],
  "sysmon-lite/11": ["TargetFilename", "Image"],
  "sysmon-lite/23": ["TargetFilename", "Image"],
};

/** Keys listed first for the key=value sources, the rest after in code-unit order. */
const FIREWALL_FIELDS = ["proto", "src", "spt", "dst", "dpt", "bytes", "rule"];
const VPN_FIELDS = ["user", "src", "assigned", "reason"];

function logEntry(record: LogRecord): TimelineEntry {
  const { kind, summary } = describeLog(record);
  return {
    at: record.at,
    source: record.source,
    kind,
    summary,
    ref: formatRef({ kind: "log", source: record.source, seq: record.seq }),
    host: record.host,
  };
}

function describeLog(record: LogRecord): { kind: string; summary: string } {
  const f = record.fields;
  switch (record.source) {
    case "security":
      return describeEvent(record, SECURITY_EVENTS);
    case "sysmon-lite":
      return describeEvent(record, SYSMON_LITE_EVENTS);
    case "web-access": {
      const method = f.method ?? "GET";
      return {
        kind: method,
        summary: `${f.clientIp ?? "-"} "${method} ${f.path ?? "/"}" ${f.status ?? "-"}`,
      };
    }
    case "firewall": {
      const { action = "entry", ...rest } = f;
      return { kind: action, summary: keyValues(rest, FIREWALL_FIELDS) };
    }
    case "dns": {
      const { client = "-", query = "-", type = "A", rcode = "NOERROR", answer } = f;
      return {
        kind: "query",
        summary: `${type} ${query} from ${client} -> ${rcode}${answer ? ` ${answer}` : ""}`,
      };
    }
    case "vpn": {
      const { event = "session", ...rest } = f;
      return { kind: event, summary: keyValues(rest, VPN_FIELDS) };
    }
  }
}

function describeEvent(
  record: LogRecord,
  table: Readonly<Record<number, EventInfo>>,
): { kind: string; summary: string } {
  const id = record.eventId;
  const info = id === undefined ? undefined : table[id];
  const wanted = SUMMARY_FIELDS[`${record.source}/${id ?? "-"}`] ?? info?.fields.slice(0, 3) ?? [];
  const fields = wanted.filter((key) => record.fields[key] !== undefined);
  const shown =
    fields.length > 0 ? fields : Object.keys(record.fields).sort(compareText).slice(0, 3);
  const details = shown.map((key) => `${key}=${quote(record.fields[key] ?? "")}`).join(" ");
  const title = info?.description ?? "Event.";
  return {
    kind: id === undefined ? "event" : String(id),
    summary: details ? `${title} ${details}` : title,
  };
}

function keyValues(fields: Readonly<Record<string, string>>, order: readonly string[]): string {
  const present = Object.keys(fields);
  const keys = [
    ...order.filter((key) => present.includes(key)),
    ...present.filter((key) => !order.includes(key)).sort(compareText),
  ];
  return keys.map((key) => `${key}=${quote(fields[key] ?? "")}`).join(" ");
}

function quote(value: string): string {
  return value === "" || /[\s"=]/.test(value) ? `"${value.replace(/["\\]/g, "\\$&")}"` : value;
}

/** Code-unit order, never locale order, so the timeline is the same on every machine. */
function compareText(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}
