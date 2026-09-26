import { base64ByteLength, decodeBase64 } from "../base64";
import { carveBytes } from "../magic";
import { formatRef, isLogSource } from "../refs";
import type { ArtefactRef, EvidenceSet, LogRecord } from "../types";

/**
 * `acceptedEvidence` patterns (docs/plan/03-case-format-and-generator.md §Case YAML).
 *
 * A report question says which evidence an answer has to point at. Writing that as a record number
 * would be hopeless — the numbers come out of the generator, and change the moment the story does
 * — so a case writes a **pattern**, and the build turns it into the concrete `ArtefactRef`s it
 * matches today:
 *
 * ```text
 * disk:qf-lt-07:mft/*inv-0412*          the file record whose path has that in it
 * disk:qf-lt-07:carve/*                 the start of unallocated space
 * disk:qf-lt-07:carve/partial pdf       what the carver finds there: by type, whole or partial,
 * disk:qf-lt-07:carve/*QF-INV-0410*     or by text inside it
 * log:security/where eventId=4624 and IpAddress=10.60.0.21
 * log:sysmon-lite/where TargetFilename=*inv-0412*
 * mem:qf-srv-01-mem:pid/*dispatch*      the process, by name, path or command line
 * mem:qf-srv-01-mem:conn/*203.0.113.*   the connection, by either address
 * mem:qf-srv-01-mem:vad/*               a stretch of memory, by address or backing file
 * ```
 *
 * `*` stands for any run of characters and matching ignores case, so a pattern says what an
 * examiner would say out loud ("the record for the invoice") rather than a number nobody chose.
 * A pattern that matches **nothing** stops the build: a question whose evidence has moved is
 * exactly the drift these patterns exist to catch.
 */

/** A pattern that matches nothing, with a message that names the question and the pattern. */
export class EvidencePatternError extends Error {
  constructor(
    readonly pattern: string,
    message: string,
    readonly where?: string,
  ) {
    super(where === undefined ? message : `${where}: ${message}`);
    this.name = "EvidencePatternError";
  }
}

/** Every artefact in `evidence` the pattern names, in ref order. Empty when it matches nothing. */
export function resolveAcceptedEvidence(evidence: EvidenceSet, pattern: string): ArtefactRef[] {
  const trimmed = pattern.trim();
  const disk = /^disk:([^:]+):(mft|carve)\/([\s\S]+)$/.exec(trimmed);
  if (disk) return diskMatches(evidence, disk[1] ?? "", disk[2] ?? "", disk[3] ?? "");

  const memory = /^mem:([^:]+):(pid|conn|vad)\/([\s\S]+)$/.exec(trimmed);
  if (memory) return memoryMatches(evidence, memory[1] ?? "", memory[2] ?? "", memory[3] ?? "");

  const log = /^log:([^/]+)\/([\s\S]+)$/.exec(trimmed);
  if (log) return logMatches(evidence, log[1] ?? "", log[2] ?? "");

  throw new EvidencePatternError(
    pattern,
    `"${pattern}" isn't an evidence pattern. Write one of: disk:<image>:mft/<what>, disk:<image>:carve/<what>, mem:<image>:pid/<what>, mem:<image>:conn/<what>, mem:<image>:vad/<what>, or log:<source>/<what>.`,
  );
}

/**
 * The refs every pattern names, with nothing repeated. Throws when one of them matches nothing,
 * because a question that points at evidence which isn't there can never be answered.
 */
export function requireAcceptedEvidence(
  evidence: EvidenceSet,
  patterns: readonly string[],
  where?: string,
): ArtefactRef[] {
  const found = new Set<ArtefactRef>();
  for (const pattern of patterns) {
    const matches = resolveAcceptedEvidence(evidence, pattern);
    if (matches.length === 0) {
      throw new EvidencePatternError(
        pattern,
        `"${pattern}" matches nothing in this case's evidence. Check the image or source name and the spelling, or change the story so the evidence is there.`,
        where,
      );
    }
    for (const ref of matches) found.add(ref);
  }
  return [...found].sort(compare);
}

// ---------------------------------------------------------------------------------------------
// Matching

function diskMatches(
  evidence: EvidenceSet,
  image: string,
  kind: string,
  selector: string,
): ArtefactRef[] {
  const wanted = glob(image);
  const found: ArtefactRef[] = [];
  for (const disk of evidence.disks) {
    if (!wanted.test(disk.id)) continue;
    if (kind === "mft") {
      for (const record of disk.records) {
        if (matchesAny(selector, [String(record.record), record.path, record.owner])) {
          found.push(formatRef({ kind: "file", image: disk.id, record: record.record }));
        }
      }
      continue;
    }
    // A carve pattern names an offset in unallocated space. "*" means every chunk boundary the
    // generator knows about, which for now is the start of the space: the carver (file 07) is
    // what turns an offset into an object.
    const length = base64ByteLength(disk.unallocatedB64);
    if (length === 0) continue;
    const digits = /^(0|[1-9][0-9]*)$/.exec(selector.trim());
    if (digits) {
      const offset = Number(digits[1]);
      if (offset < length) found.push(formatRef({ kind: "carve", image: disk.id, offset }));
      continue;
    }
    if (selector.trim() === "*") {
      found.push(formatRef({ kind: "carve", image: disk.id, offset: 0 }));
      continue;
    }
    // Anything else names what the carver finds, by what an examiner would say about it: its type
    // ("pdf"), whether it is whole ("partial pdf"), or text inside it ("*QF-INV-0410*"). The same
    // scan `carve` makes, so the offset is the one its ref prints.
    for (const object of carveBytes(decodeBase64(disk.unallocatedB64))) {
      const state = `${object.complete ? "complete" : "partial"} ${object.type}`;
      if (matchesAny(selector, [object.type, state, latin1(object.bytes)])) {
        found.push(formatRef({ kind: "carve", image: disk.id, offset: object.offset }));
      }
    }
  }
  return found.sort(compare);
}

function memoryMatches(
  evidence: EvidenceSet,
  image: string,
  kind: string,
  selector: string,
): ArtefactRef[] {
  const wanted = glob(image);
  const found: ArtefactRef[] = [];
  for (const memory of evidence.memory) {
    if (!wanted.test(memory.id) && !wanted.test(memory.host)) continue;
    if (kind === "pid") {
      for (const process of memory.processes) {
        if (
          matchesAny(selector, [
            String(process.pid),
            process.name,
            process.path,
            process.cmdline,
            process.user,
          ])
        ) {
          found.push(formatRef({ kind: "process", image: memory.id, pid: process.pid }));
        }
      }
    } else if (kind === "conn") {
      memory.connections.forEach((connection, index) => {
        if (
          matchesAny(selector, [
            String(index),
            connection.remote,
            connection.local,
            connection.state,
            connection.proto,
          ])
        ) {
          found.push(formatRef({ kind: "connection", image: memory.id, index }));
        }
      });
    } else {
      for (const region of memory.regions) {
        if (
          matchesAny(selector, [
            String(region.base),
            `0x${region.base.toString(16)}`,
            region.protection,
            region.backedBy ?? "",
          ])
        ) {
          found.push(formatRef({ kind: "region", image: memory.id, base: region.base }));
        }
      }
    }
  }
  return found.sort(compare);
}

function logMatches(evidence: EvidenceSet, source: string, selector: string): ArtefactRef[] {
  const wanted = glob(source);
  if (!source.includes("*") && !isLogSource(source)) {
    throw new EvidencePatternError(
      `log:${source}/${selector}`,
      `"${source}" isn't a log source. The sources are: security, sysmon-lite, web-access, firewall, dns, vpn.`,
    );
  }
  const where = conditionsOf(selector, `log:${source}/${selector}`);
  return evidence.logs
    .filter((record) => wanted.test(record.source))
    .filter((record) =>
      where
        ? where.every(([key, value]) => matches(value, fieldOf(record, key)))
        : matchesAny(selector, [String(record.seq), record.host, String(record.eventId ?? "")]),
    )
    .map((record) => formatRef({ kind: "log", source: record.source, seq: record.seq }))
    .sort(compare);
}

/** `where eventId=4624 and IpAddress=10.60.0.21` → the pairs to check. Undefined for a glob. */
function conditionsOf(selector: string, pattern: string): [string, string][] | undefined {
  const match = /^\s*where\s+([\s\S]+)$/i.exec(selector);
  if (!match) return undefined;
  const conditions = (match[1] ?? "").split(/\s+and\s+/i).map((part) => part.trim());
  return conditions.map((condition) => {
    const split = condition.indexOf("=");
    if (split <= 0) {
      throw new EvidencePatternError(
        pattern,
        `"${condition}" isn't a condition. Write them as field=value, joined by "and": where eventId=4624 and TargetUserName=dana.`,
      );
    }
    return [condition.slice(0, split).trim(), condition.slice(split + 1).trim()];
  });
}

/** A record's value for a condition's key: its own columns first, then its fields. */
function fieldOf(record: LogRecord, key: string): string {
  const lower = key.toLowerCase();
  if (lower === "eventid") return String(record.eventId ?? "");
  if (lower === "host") return record.host;
  if (lower === "source") return record.source;
  if (lower === "seq") return String(record.seq);
  const named = Object.entries(record.fields).find(([name]) => name.toLowerCase() === lower);
  return named?.[1] ?? "";
}

const globs = new Map<string, RegExp>();

/** `*` is any run of characters, `?` is one, and everything else is itself. Case is ignored. */
function glob(pattern: string): RegExp {
  const trimmed = pattern.trim();
  let compiled = globs.get(trimmed);
  if (!compiled) {
    const body = trimmed
      .split("")
      .map((char) =>
        char === "*"
          ? "[\\s\\S]*"
          : char === "?"
            ? "[\\s\\S]"
            : char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("");
    compiled = new RegExp(`^${body}$`, "i");
    globs.set(trimmed, compiled);
  }
  return compiled;
}

/** Bytes as text, one character per byte, so a search can't be thrown by a broken sequence. */
const latin1 = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

function matches(pattern: string, value: string): boolean {
  return glob(pattern).test(value);
}

function matchesAny(pattern: string, values: readonly string[]): boolean {
  const compiled = glob(pattern);
  return values.some((value) => compiled.test(value));
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
