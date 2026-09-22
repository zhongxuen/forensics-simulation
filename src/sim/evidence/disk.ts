import { decodeBase64 } from "./base64";
import type { DiskImage, FileRecord, Instant } from "./types";

/**
 * Two ways to open a disk image (docs/plan/02-evidence-model.md §Disk image):
 *
 * - `mountRead` is what a write-blocker gives you: a read view that changes nothing.
 * - `mountWrite` is what plugging the original into a normal computer does: the operating system
 *   opens files as it mounts and browses, and every file it opens gets a new access time. It returns
 *   a changed copy, which is Case 1's wrong turn (the image hash no longer matches the handover).
 */

/** A read-only view of one disk image. Nothing in it changes the image. */
export interface DiskView {
  readonly image: DiskImage;
  /** Every record, live and deleted, in record-number order. */
  readonly records: readonly FileRecord[];
  record(record: number): FileRecord | undefined;
  /** Every record at `path` (Windows paths ignore case), live first, then deleted. */
  atPath(path: string): readonly FileRecord[];
  /** The records directly inside the directory `path`, live and deleted, in record order. */
  children(path: string): readonly FileRecord[];
  /** A record's content bytes. */
  content(file: FileRecord): Uint8Array;
}

export function mountRead(disk: DiskImage): DiskView {
  const records = [...disk.records].sort((x, y) => x.record - y.record);
  const byRecord = new Map(records.map((r) => [r.record, r]));
  return {
    image: disk,
    records,
    record: (record) => byRecord.get(record),
    atPath: (path) => {
      const key = pathKey(path);
      const found = records.filter((r) => pathKey(r.path) === key);
      return [...found.filter((r) => !r.deleted), ...found.filter((r) => r.deleted)];
    },
    children: (path) => {
      const key = pathKey(path);
      return records.filter((r) => {
        const parent = parentPath(r.path);
        return parent !== undefined && pathKey(parent) === key;
      });
    },
    content: (file) => decodeBase64(file.contentB64),
  };
}

export interface MountWriteOptions {
  /**
   * The record numbers the operating system opens. Defaults to every live (not deleted) record:
   * mounting lists every folder, and indexing, previews and virus scans open the files.
   * Deleted records are never touched, because nothing can open them.
   */
  readonly records?: readonly number[];
}

/**
 * A copy of `disk` as it is after being mounted read-write at `at`: each opened record's access
 * time becomes `at`. Nothing else changes, and `disk` itself is left as it was.
 */
export function mountWrite(
  disk: DiskImage,
  at: Instant,
  options: MountWriteOptions = {},
): DiskImage {
  if (!Number.isFinite(at))
    throw new RangeError(`mountWrite: at must be a finite instant, got ${at}`);
  const opened = options.records ? new Set(options.records) : undefined;
  return {
    ...disk,
    records: disk.records.map((r) =>
      r.deleted || (opened && !opened.has(r.record)) ? r : { ...r, times: { ...r.times, a: at } },
    ),
  };
}

/** "C:\\Users\\dana" → "C:\\"; "C:\\" → undefined (the root has no parent). */
export function parentPath(path: string): string | undefined {
  const trimmed = path.endsWith("\\") ? path.slice(0, -1) : path;
  const cut = trimmed.lastIndexOf("\\");
  if (cut < 0) return undefined;
  const parent = trimmed.slice(0, cut);
  return /^[A-Za-z]:$/.test(parent) ? `${parent}\\` : parent;
}

/** The last part of a Windows path: "C:\\Users\\dana\\a.txt" → "a.txt". The root is itself. */
export function baseName(path: string): string {
  if (/^[A-Za-z]:\\?$/.test(path)) return path;
  const trimmed = path.endsWith("\\") ? path.slice(0, -1) : path;
  return trimmed.slice(trimmed.lastIndexOf("\\") + 1);
}

/** Windows paths compare without case and without a trailing separator (except the root's). */
function pathKey(path: string): string {
  const lower = path.toLowerCase();
  return lower.endsWith("\\") && !/^[a-z]:\\$/.test(lower) ? lower.slice(0, -1) : lower;
}
