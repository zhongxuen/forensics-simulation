import { baseName, formatInstant, UTC_ZONE, zonePeriodAt } from "@/sim";
import type { DiskView, FileRecord, Instant, MacbTimes } from "@/sim/types";
import { byName, rootRecords } from "./tree";

/**
 * The browser's table: the records in a folder (or, while a filter is on, on the whole drive),
 * sorted by any column and filtered to deleted records or to a time window. Pure, so the sort and
 * filter rules are tested without a browser.
 */

export type ColumnKey = "name" | "record" | "size" | "owner" | keyof MacbTimes;
export type SortDirection = "ascending" | "descending";

export interface SortOrder {
  readonly column: ColumnKey;
  readonly direction: SortDirection;
}

export const DEFAULT_SORT: SortOrder = { column: "name", direction: "ascending" };

/** Which of the four times a time window looks at. */
export type TimeField = keyof MacbTimes | "any";

export interface RecordFilter {
  readonly deletedOnly: boolean;
  /** Which time must fall in the window. */
  readonly field: TimeField;
  /** Inclusive, as instants. Either end may be open. */
  readonly from?: Instant;
  readonly to?: Instant;
}

export const NO_FILTER: RecordFilter = { deletedOnly: false, field: "any" };

/** True when the filter narrows anything, which widens the table to the whole drive. */
export const filtering = (filter: RecordFilter): boolean =>
  filter.deletedOnly || filter.from !== undefined || filter.to !== undefined;

export const MACB_KEYS: readonly (keyof MacbTimes)[] = ["m", "a", "c", "b"];

/** What each MACB letter stands for, for column headers and the metadata tab. */
export const MACB_NAMES: Readonly<Record<keyof MacbTimes, string>> = {
  m: "Modified",
  a: "Accessed",
  c: "Changed",
  b: "Born",
};

export function matches(record: FileRecord, filter: RecordFilter): boolean {
  if (filter.deletedOnly && !record.deleted) return false;
  if (filter.from === undefined && filter.to === undefined) return true;
  const times =
    filter.field === "any"
      ? MACB_KEYS.map((key) => record.times[key])
      : [record.times[filter.field]];
  return times.some(
    (at) =>
      (filter.from === undefined || at >= filter.from) &&
      (filter.to === undefined || at <= filter.to),
  );
}

function compare(x: FileRecord, y: FileRecord, column: ColumnKey): number {
  switch (column) {
    case "name":
      return byName(x, y);
    case "record":
      return x.record - y.record;
    case "size":
      return x.size - y.size || byName(x, y);
    case "owner":
      return x.owner.localeCompare(y.owner, "en") || byName(x, y);
    default:
      return x.times[column] - y.times[column] || byName(x, y);
  }
}

export function sortRecords(records: readonly FileRecord[], order: SortOrder): FileRecord[] {
  const sign = order.direction === "ascending" ? 1 : -1;
  return [...records].sort((x, y) => sign * compare(x, y, order.column));
}

/**
 * The rows to show: `folder`'s records (the drive's root records when it's undefined), or every
 * record on the drive when a filter is on, filtered and sorted.
 */
export function tableRows(
  view: DiskView,
  folder: string | undefined,
  filter: RecordFilter,
  order: SortOrder,
): FileRecord[] {
  const scope = filtering(filter)
    ? view.records
    : folder === undefined
      ? rootRecords(view)
      : view.children(folder);
  return sortRecords(
    scope.filter((record) => matches(record, filter)),
    order,
  );
}

/** A record's name as the table shows it. */
export const recordName = (record: FileRecord): string => baseName(record.path);

// ---------------------------------------------------------------------------------------------
// Time, in UTC or the drive's own zone

/**
 * A time as the table shows it: `2026-04-11T19:40:12Z` in UTC, or `2026-04-11 20:40:12 +01:00`
 * in the drive's zone. Falls back to UTC for an instant the offset table doesn't cover, rather than
 * failing to draw the row.
 */
export function showTime(at: Instant, zone: string): string {
  if (zone === UTC_ZONE || zonePeriodAt(zone, at) === undefined) return formatInstant(at);
  return formatInstant(at, { zone });
}

/**
 * The instant a wall-clock time means in `zone`: `2026-04-11T20:40` (a datetime-local input's
 * value, seconds optional) in Europe/London is 19:40 UTC. Undefined for a value that isn't one, or
 * a time the offset table doesn't cover.
 */
export function wallTimeToInstant(value: string, zone: string): Instant | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s] = match.map(Number) as number[];
  const wall = Date.UTC(y as number, (mo as number) - 1, d, h, mi, Number.isNaN(s) ? 0 : s);
  if (Number.isNaN(wall)) return undefined;
  if (zone === UTC_ZONE) return wall;
  // The offset at the wall time, then again at the instant it gives: right across a change.
  const first = zonePeriodAt(zone, wall);
  if (!first) return undefined;
  const guess = wall - first.offsetMinutes * 60_000;
  const second = zonePeriodAt(zone, guess);
  return second ? wall - second.offsetMinutes * 60_000 : undefined;
}

/** A byte count the way a file list shows it: "812 bytes", "4 KB", "1.2 MB". Folders show "-". */
export function formatSize(record: FileRecord): string {
  if (record.kind === "dir") return "-";
  const bytes = record.size;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
}
