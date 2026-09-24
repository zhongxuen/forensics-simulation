import { formatRef } from "@/sim";
import type { ArtefactRef, Instant, MemoryImage, MemoryProcess } from "@/sim/types";

/**
 * The Processes tab's table (docs/plan/08-memory-tools.md): every process a scan of a memory image
 * finds, the same list `mem psscan` prints, with whether a walk of the active list (`mem ps`)
 * would find it. Pure, so the rules are tested without a browser.
 */

/** Why a process is missing from the active list, when it is. */
export type ListStatus = "listed" | "unlinked" | "exited";

export interface ProcessRow {
  readonly pid: number;
  readonly ppid: number;
  readonly name: string;
  readonly path: string;
  readonly user: string;
  readonly createdAt: Instant;
  readonly exitedAt?: Instant;
  readonly status: ListStatus;
  readonly ref: ArtefactRef;
}

export type ProcessColumn = "pid" | "ppid" | "name" | "created" | "exited" | "user" | "listed";

export interface ProcessSort {
  readonly column: ProcessColumn;
  readonly direction: "ascending" | "descending";
}

/** The order `mem psscan` prints them in: when they started. */
export const DEFAULT_PROCESS_SORT: ProcessSort = { column: "created", direction: "ascending" };

/** Same rule as the engine's active list: an unlinked or exited process isn't on it. */
export function listStatus(process: MemoryProcess): ListStatus {
  if (process.unlinked) return "unlinked";
  if (process.exitedAt !== undefined) return "exited";
  return "listed";
}

export function processRows(image: MemoryImage): ProcessRow[] {
  return image.processes.map((process) => ({
    pid: process.pid,
    ppid: process.ppid,
    name: process.name,
    path: process.path,
    user: process.user,
    createdAt: process.createdAt,
    ...(process.exitedAt === undefined ? {} : { exitedAt: process.exitedAt }),
    status: listStatus(process),
    ref: formatRef({ kind: "process", image: image.id, pid: process.pid }),
  }));
}

/** "Yes", or "No" with the reason, as the "In active list?" column says it. */
export function listedLabel(status: ListStatus): string {
  switch (status) {
    case "listed":
      return "Yes";
    case "unlinked":
      return "No: unlinked (hidden while running)";
    case "exited":
      return "No: exited before the capture";
  }
}

const STATUS_ORDER: Readonly<Record<ListStatus, number>> = { listed: 0, unlinked: 1, exited: 2 };

function compare(x: ProcessRow, y: ProcessRow, column: ProcessColumn): number {
  const byStart = x.createdAt - y.createdAt || x.pid - y.pid;
  switch (column) {
    case "pid":
      return x.pid - y.pid;
    case "ppid":
      return x.ppid - y.ppid || byStart;
    case "name":
      return x.name.localeCompare(y.name, "en") || byStart;
    case "created":
      return byStart;
    case "exited":
      // Still running sorts after every exit time.
      return (x.exitedAt ?? Infinity) - (y.exitedAt ?? Infinity) || byStart;
    case "user":
      return x.user.localeCompare(y.user, "en") || byStart;
    case "listed":
      return STATUS_ORDER[x.status] - STATUS_ORDER[y.status] || byStart;
  }
}

export function sortProcesses(rows: readonly ProcessRow[], order: ProcessSort): ProcessRow[] {
  const sign = order.direction === "ascending" ? 1 : -1;
  return [...rows].sort((x, y) => sign * compare(x, y, order.column));
}

/** Clicking a column's header: sort by it, or turn the direction round if it already is. */
export function nextSort(current: ProcessSort, column: ProcessColumn): ProcessSort {
  if (current.column !== column) return { column, direction: "ascending" };
  return { column, direction: current.direction === "ascending" ? "descending" : "ascending" };
}
