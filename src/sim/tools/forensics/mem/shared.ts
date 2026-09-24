/**
 * What every `mem` subcommand needs (docs/plan/08-memory-tools.md): finding the memory image a
 * case hands over, the two lists a memory image can be read as (the active list and a scan), the
 * refs its lines carry, and the small pieces of formatting the subcommands share.
 *
 * A memory image is not a device. Nothing reads it through a write-blocker, and reading it changes
 * nothing, so these are plain functions of the image. Output formats are written from the public
 * descriptions of what memory tools report, never copied, and they are a teaching model: real
 * memory analysis reads raw kernel structures whose layout changes with every build of the
 * operating system.
 */
import { err, ok, type Result } from "../../../core/result";
import type { SimError } from "../../../core/errors";
import type { OutputLine, SimEvent } from "../../../core/types";
import { formatRef } from "../../../evidence/refs";
import type { EvidenceSession } from "../../../evidence/session";
import type {
  ArtefactRef,
  MemoryConnection,
  MemoryImage,
  MemoryProcess,
} from "../../../evidence/types";
import type { DisplayZone } from "../shared";

/**
 * The memory image a name on the command line stands for: its id (`qf-srv-01-mem`) or the host it
 * was taken from (`qf-srv-01`), in any case.
 */
export function findMemory(session: EvidenceSession, name: string): Result<MemoryImage, SimError> {
  const wanted = name.toLowerCase();
  const found = session.set.memory.find(
    (image) => image.id.toLowerCase() === wanted || image.host.toLowerCase() === wanted,
  );
  return found ? ok(found) : err({ code: "MEMORY_NOT_FOUND", name });
}

/** A pid as the player typed it: a whole number, nothing else. */
export function parsePid(value: string): Result<number, SimError> {
  if (!/^\d{1,9}$/.test(value)) {
    return err({ code: "BAD_ARGUMENT", argument: "--pid", value, reason: "bad-format" });
  }
  return ok(Number(value));
}

/**
 * Every process a scan of the image finds, in the order they started: the ones in the active
 * list, the ones unlinked from it, and the ones that have exited but whose records are still in
 * memory.
 */
export function scanProcesses(image: MemoryImage): readonly MemoryProcess[] {
  return [...image.processes].sort((x, y) => x.createdAt - y.createdAt || x.pid - y.pid);
}

/**
 * The processes a walk of the active process list finds. An unlinked process has been taken out
 * of the list while it keeps running, and an exited one has left it, so neither is here.
 */
export function listProcesses(image: MemoryImage): readonly MemoryProcess[] {
  return scanProcesses(image).filter(inActiveList);
}

/** Whether a walk of the active list would find this process. */
export const inActiveList = (process: MemoryProcess): boolean =>
  !process.unlinked && process.exitedAt === undefined;

/** How a scan marks a process: "unlinked", "exited", or nothing for one in the active list. */
export function processMark(process: MemoryProcess): string {
  if (process.unlinked) return "unlinked";
  if (process.exitedAt !== undefined) return "exited";
  return "";
}

/** The process with this pid, found by scanning, or the error naming what was asked for. */
export function requireProcess(image: MemoryImage, pid: number): Result<MemoryProcess, SimError> {
  const found = image.processes.find((process) => process.pid === pid);
  return found ? ok(found) : err({ code: "PROCESS_NOT_FOUND", image: image.id, pid });
}

/** A process's name by pid, from a scan, so a connection's owner shows even when it is hidden. */
export function ownerName(image: MemoryImage, pid: number): string {
  return image.processes.find((process) => process.pid === pid)?.name ?? "-";
}

/** The connections, in the order they were made; each keeps its index, which is its ref. */
export function connectionsInOrder(
  image: MemoryImage,
): readonly { readonly index: number; readonly connection: MemoryConnection }[] {
  return image.connections
    .map((connection, index) => ({ index, connection }))
    .sort((x, y) => x.connection.createdAt - y.connection.createdAt || x.index - y.index);
}

export const processRef = (image: MemoryImage, pid: number): ArtefactRef =>
  formatRef({ kind: "process", image: image.id, pid });

export const connectionRef = (image: MemoryImage, index: number): ArtefactRef =>
  formatRef({ kind: "connection", image: image.id, index });

export const regionRef = (image: MemoryImage, base: number): ArtefactRef =>
  formatRef({ kind: "region", image: image.id, base });

/** An address the way memory tools print one: `0x00400000`. */
export const hexAddress = (value: number): string => `0x${value.toString(16).padStart(8, "0")}`;

/** What a subcommand is asked to show: one image, the zone for its times, maybe one process. */
export interface MemRequest {
  readonly image: MemoryImage;
  readonly zone: DisplayZone;
  /** Set by `--pid`, already checked to be a process in the image. */
  readonly pid?: number;
  /** The zone the host's own clock showed, when the case says, for `info`. */
  readonly hostZone?: string;
}

/** What a subcommand printed below the banner, the banner's own details, and its one event. */
export interface MemReport {
  /** Extra parts of the banner line after the image id: "12 processes". */
  readonly summary: readonly string[];
  readonly lines: readonly OutputLine[];
  /** Absent only for a subcommand that isn't built yet, so no objective counts it as done. */
  readonly event?: SimEvent;
}

/** A stdout line that shows one artefact, carrying its ref for `pin` and the grader. */
export const refLine = (text: string, ref: ArtefactRef): OutputLine => ({
  stream: "stdout",
  text,
  ref,
});
