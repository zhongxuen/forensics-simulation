import { formatInstant as formatUtc } from "../core/clock";
import type { Instant } from "./types";

/**
 * Time zones without `Intl`. Evidence times are always UTC `Instant`s; some sources *display*
 * local time. The offsets come from the small committed table below, which covers only the dates
 * the cases use, so output never depends on the machine's time-zone database.
 * tests/unit/evidence-time.test.ts checks every entry against `Intl.DateTimeFormat` (tests may use
 * `Intl`, the engine may not).
 *
 * To add a zone or a year, add its periods here (each starts at a UTC instant and runs until the
 * next one) and rerun that test.
 */
export interface ZonePeriod {
  /** The UTC instant this offset starts. */
  readonly from: Instant;
  /** Local time minus UTC, in minutes. */
  readonly offsetMinutes: number;
  /** The usual short name, for display only: "GMT", "BST". */
  readonly abbreviation: string;
}

export interface ZoneEntry {
  /** The instants the table is good for: `from` inclusive, `to` exclusive. */
  readonly covers: { readonly from: Instant; readonly to: Instant };
  /** In time order. The first starts at `covers.from`. */
  readonly periods: readonly ZonePeriod[];
}

export const UTC_ZONE = "UTC";

export const ZONE_TABLE: Readonly<Record<string, ZoneEntry>> = {
  // UK: British Summer Time runs from 01:00 UTC on the last Sunday of March to 01:00 UTC on the
  // last Sunday of October. The cases happen in April 2026 (Quillfen Freight is in the UK).
  "Europe/London": {
    covers: { from: Date.UTC(2026, 0, 1), to: Date.UTC(2027, 0, 1) },
    periods: [
      { from: Date.UTC(2026, 0, 1), offsetMinutes: 0, abbreviation: "GMT" },
      { from: Date.UTC(2026, 2, 29, 1), offsetMinutes: 60, abbreviation: "BST" },
      { from: Date.UTC(2026, 9, 25, 1), offsetMinutes: 0, abbreviation: "GMT" },
    ],
  },
};

/** True for "UTC" and every zone in the offset table. */
export function isKnownZone(zone: string): boolean {
  return zone === UTC_ZONE || Object.hasOwn(ZONE_TABLE, zone);
}

/** The period in force in `zone` at `ms`, or undefined if the table doesn't cover that instant. */
export function zonePeriodAt(zone: string, ms: Instant): ZonePeriod | undefined {
  if (zone === UTC_ZONE) return { from: -Infinity, offsetMinutes: 0, abbreviation: "UTC" };
  const entry = Object.hasOwn(ZONE_TABLE, zone) ? ZONE_TABLE[zone] : undefined;
  if (!entry || ms < entry.covers.from || ms >= entry.covers.to) return undefined;
  let found: ZonePeriod | undefined;
  for (const period of entry.periods) {
    if (period.from > ms) break;
    found = period;
  }
  return found;
}

/**
 * Local time minus UTC in `zone` at `ms`, in minutes. Throws a RangeError for a zone or date the
 * table doesn't cover: evidence is generated inside the table, so that's a bug, not player input.
 */
export function zoneOffsetMinutes(zone: string, ms: Instant): number {
  const period = zonePeriodAt(zone, ms);
  if (!period) {
    throw new RangeError(
      isKnownZone(zone)
        ? `The offset table has no entry for ${zone} at ${formatUtc(ms)}. Add that year to src/sim/evidence/time.ts.`
        : `Unknown time zone "${zone}". Add it to the offset table in src/sim/evidence/time.ts.`,
    );
  }
  return period.offsetMinutes;
}

/** "+01:00", or "+0100" with `separator: ""`. */
export function formatOffset(offsetMinutes: number, separator = ":"): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return `${sign}${pad2(Math.floor(abs / 60))}${separator}${pad2(abs % 60)}`;
}

/** The wall-clock fields of `ms` in `zone`, plus the offset used. */
export interface ZonedParts {
  readonly year: number;
  /** 1 to 12. */
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly offsetMinutes: number;
}

export function zonedParts(ms: Instant, zone: string = UTC_ZONE): ZonedParts {
  const offsetMinutes = zoneOffsetMinutes(zone, ms);
  // Shifting the instant by the offset and reading it back as UTC gives the local wall clock.
  const local = new Date(ms + offsetMinutes * 60_000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
    offsetMinutes,
  };
}

export interface FormatInstantOptions {
  /** An IANA zone from the offset table, or "UTC" (the default). */
  readonly zone?: string;
}

/**
 * Renders an instant in UTC ("2026-03-02T09:00:00Z") or, given a zone, as local time with its
 * offset ("2026-04-11 20:40:12 +01:00"). Milliseconds are dropped. With no zone this is exactly
 * the vendored `formatInstant` from core/clock.ts.
 */
export function formatInstant(ms: Instant, options: FormatInstantOptions = {}): string {
  const zone = options.zone ?? UTC_ZONE;
  if (zone === UTC_ZONE) return formatUtc(ms);
  const p = zonedParts(ms, zone);
  return (
    `${p.year}-${pad2(p.month)}-${pad2(p.day)} ` +
    `${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)} ${formatOffset(p.offsetMinutes)}`
  );
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
