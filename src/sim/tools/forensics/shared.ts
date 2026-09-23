/**
 * What every disk tool needs (docs/plan/04-disk-tools.md): finding the evidence attached to the
 * workstation, turning a name on the command line into a set of image bytes, reading an original
 * through (or around) its write-blocker, and the small pieces of formatting they share.
 *
 * Output formats are written here from the public descriptions of what real tools report. None of
 * it is copied from a real tool, and the tools themselves carry made-up names
 * (docs/plan/99-reference.md §Simulation framing).
 */
import { stdout } from "../../core/output";
import { err, ok, type Result } from "../../core/result";
import type { SimError } from "../../core/errors";
import { sessionFs } from "../../core/session";
import type { OutputLine, SimEvent, SimResult, SimState } from "../../core/types";
import { mountRead, type DiskView } from "../../evidence/disk";
import { formatRef } from "../../evidence/refs";
import {
  deviceAt,
  imageAt,
  isEvidencePath,
  pathsForImage,
  readOriginal,
  rememberOutput,
  type AttachedItem,
  type EvidenceSession,
} from "../../evidence/session";
import { formatInstant, UTC_ZONE } from "../../evidence/time";
import type { ArtefactRef, DiskImage, FileRecord, Instant } from "../../evidence/types";
import { realpath, type FsContext } from "../../fs/ops";
import { normalizePath } from "../../fs/path";
import type { Vfs } from "../../fs/types";
import { hasSwitch, optionValue, type ParsedArgs } from "../args";
import type { OptionSpec } from "../args";
import type { ToolContext } from "../types";

/** The one option every tool that prints a time takes. */
export const ZONE_OPTION: OptionSpec = { names: ["--zone"], key: "zone", takesValue: true };

/** A name on the command line, resolved to the image bytes it stands for. */
export interface ImageTarget {
  /** Canonical workstation path: an evidence device, or a working copy. */
  readonly path: string;
  /** The image as it stands right now, before this command reads it. */
  readonly image: DiskImage;
  /** Set when `path` is the original device rather than a copy of it. */
  readonly device?: AttachedItem;
}

/** The evidence attached to this workstation, or the error a tool reports when there is none. */
export function requireEvidence(state: SimState): Result<EvidenceSession, SimError> {
  return state.evidence ? ok(state.evidence) : err({ code: "EVIDENCE_NOT_LOADED" });
}

/**
 * Turns `qf-lt-07`, `/dev/evidence/qf-lt-07` or `~/cases/images/qf-lt-07.img` into the image it
 * names. A bare id means the working copy, and falls back to the original when no copy exists,
 * so `lsfs qf-lt-07` starts using your copy the moment you make one.
 */
export function findImage(
  session: EvidenceSession,
  vfs: Vfs,
  ctx: FsContext,
  name: string,
): Result<ImageTarget, SimError> {
  const notEvidence = err<SimError>({ code: "NOT_EVIDENCE", name });
  if (name === "") return notEvidence;

  if (!name.includes("/")) {
    const path = pathsForImage(session, name)[0];
    if (path === undefined) return notEvidence;
    return targetAt(session, path);
  }
  const found = realpath(vfs, ctx, name);
  if (!found.ok) return found.error.code === "ENOENT" ? notEvidence : err(found.error);
  return targetAt(session, found.value);
}

function targetAt(session: EvidenceSession, path: string): Result<ImageTarget, SimError> {
  const image = imageAt(session, path);
  if (!image) return err({ code: "NOT_EVIDENCE", name: path });
  const device = deviceAt(session, path);
  return ok({ path, image, ...(device ? { device } : {}) });
}

/** A read of an image, and what it cost: reading an original device can change it. */
export interface OpenedImage {
  readonly state: SimState;
  readonly view: DiskView;
  readonly events: readonly SimEvent[];
  /**
   * Present when the read went around the write-blocker: the lines to print so the player knows
   * the original changed under them.
   */
  readonly warning?: readonly string[];
}

/**
 * Opens an image for reading. A working copy is just read. An original device is read the way its
 * write-blocker says: with it on, nothing changes; with it off, every live record's access time
 * becomes `now`, and the drive's hash changes with it.
 */
export function openImage(
  state: SimState,
  target: ImageTarget,
  tool: string,
  now: Instant,
): OpenedImage {
  if (!target.device) return { state, view: mountRead(target.image), events: [] };
  const read = readOriginal(state, target.device, tool, now);
  if (read.blocker) return { state: read.state, view: read.view, events: [read.event] };
  return {
    state: read.state,
    view: read.view,
    events: [read.event],
    warning: blockerOffWarning(target.device),
  };
}

/** What a tool says when it has just read an original with the write-blocker off. */
export function blockerOffWarning(device: AttachedItem): readonly string[] {
  return [
    `Careful: the write-blocker is off for ${device.path}, so reading it has just`,
    "set a new access time on every live file on the original drive. The drive's hash",
    "has moved with them, and it will no longer match the handover form.",
    "",
    `Turn it back on with: blocker on ${device.path}`,
    "Undo the change to the drive with Reset machine.",
  ];
}

/**
 * Canonicalizes a `--out` path and refuses one that lands on the evidence device. Nothing the
 * player writes is ever allowed onto evidence, which is the habit the whole game is about.
 */
export function outPath(state: SimState, value: string): Result<string, SimError> {
  const path = normalizePath(value, state.session.cwd);
  return isEvidencePath(path) ? err({ code: "WRITE_TO_EVIDENCE", path }) : ok(path);
}

/** The one record with this number, or the error naming what was asked for. */
export function requireRecord(
  view: DiskView,
  image: string,
  record: number,
): Result<FileRecord, SimError> {
  const found = view.record(record);
  return found ? ok(found) : err({ code: "RECORD_NOT_FOUND", image, record });
}

/** A record number as the player typed it: whole, not negative, not something else entirely. */
export function parseRecordNumber(value: string): Result<number, SimError> {
  if (!/^\d{1,9}$/.test(value)) {
    return err({ code: "BAD_ARGUMENT", argument: "record", value, reason: "bad-format" });
  }
  return ok(Number(value));
}

/** Which zone a tool prints times in: UTC unless `--zone local`, and the label to show. */
export interface DisplayZone {
  readonly zone: string;
  /** "UTC", or the disk's own zone when local time was asked for. */
  readonly label: string;
}

export function displayZone(
  session: EvidenceSession,
  parsed: ParsedArgs,
): Result<DisplayZone, SimError> {
  const asked = optionValue(parsed, "zone");
  if (asked === undefined || asked.toLowerCase() === "utc") {
    return ok({ zone: UTC_ZONE, label: UTC_ZONE });
  }
  if (asked.toLowerCase() !== "local") {
    return err({ code: "BAD_ARGUMENT", argument: "--zone", value: asked, reason: "unknown-value" });
  }
  const zone = session.set.zones.disk;
  return ok(zone === undefined ? { zone: UTC_ZONE, label: UTC_ZONE } : { zone, label: zone });
}

/** A file time, in the zone the tool was asked for. */
export const showTime = (at: Instant, zone: DisplayZone): string =>
  formatInstant(at, { zone: zone.zone });

/** The ref for one file record: what `pin` stores and the grader checks. */
export const recordRef = (image: string, record: number): ArtefactRef =>
  formatRef({ kind: "file", image, record });

/** "1000-1002, 1007", the way an examiner writes a run of clusters down. */
export function clusterRanges(clusters: readonly number[]): string {
  if (clusters.length === 0) return "none";
  const sorted = [...clusters].sort((x, y) => x - y);
  const parts: string[] = [];
  let start = sorted[0] as number;
  let end = start;
  for (const cluster of sorted.slice(1)) {
    if (cluster === end + 1) {
      end = cluster;
      continue;
    }
    parts.push(start === end ? `${start}` : `${start}-${end}`);
    start = cluster;
    end = cluster;
  }
  parts.push(start === end ? `${start}` : `${start}-${end}`);
  return parts.join(", ");
}

/** Which of a record's clusters a live file has taken over, and which file took them. */
export interface ClusterReuse {
  readonly clusters: readonly number[];
  /** The live record now using them, when there is one. */
  readonly by?: FileRecord;
}

/**
 * Whether anything has been written over a deleted file's clusters. While nothing has, the
 * content is still sitting there and `recover` can write it out; once something has, those bytes
 * are gone for good.
 */
export function clusterReuse(view: DiskView, record: FileRecord): ClusterReuse {
  const mine = new Set(record.clusters);
  const taken = new Set<number>();
  let by: FileRecord | undefined;
  for (const other of view.records) {
    if (other.record === record.record || other.deleted) continue;
    for (const cluster of other.clusters) {
      if (!mine.has(cluster)) continue;
      taken.add(cluster);
      by ??= other;
    }
  }
  const clusters = [...taken].sort((x, y) => x - y);
  return { clusters, ...(by ? { by } : {}) };
}

/** Every tool's first line: its name, that it's simulated, and what it was pointed at. */
export const banner = (tool: string, ...parts: readonly string[]): OutputLine =>
  stdout([`${tool} (simulated)`, ...parts].join(" · "));

/** A whole number with thousands separators, as a report would print it. */
export function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * A forensics tool's successful result: the output, its events, and a note of what was printed so
 * `pin` can point back at one of the lines.
 */
export function delivered(
  state: SimState,
  command: string,
  output: readonly OutputLine[],
  events: readonly SimEvent[] = [],
): SimResult {
  return {
    state: rememberOutput(state, command, output),
    output,
    events,
    exitCode: 0,
  };
}

/** The filesystem as the session's user sees it, for tools that read or write workstation files. */
export function workstationFs(state: SimState, ctx: ToolContext): { vfs: Vfs; ctx: FsContext } {
  return sessionFs(state, ctx.now);
}

/** True when a switch was passed, kept here so the tools read the same way. */
export const flag = hasSwitch;
