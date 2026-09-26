import {
  formatOffset,
  isMacbKind,
  sourceZone,
  TIMELINE_SOURCES,
  timelineTime,
  UTC_ZONE,
  zonePeriodAt,
} from "@/sim";
import type { EvidenceSet, Instant, TimelineEntry, TimelineSource } from "@/sim/types";

/**
 * The Timeline view's pure parts (docs/plan/09-timeline.md §The view): which tracks show, moving
 * between moments, what lights up around a chosen one, the zoom levels and the axis, and the zone
 * banner. Everything here is a function of the entries `buildTimeline` returns, which are already
 * in their one fixed order, so the view never sorts anything itself.
 */

/** One track per source, named the way a beginner reads it. */
export const TRACK_LABELS: Readonly<Record<TimelineSource, string>> = {
  disk: "Drive",
  memory: "Memory",
  security: "Security log",
  "sysmon-lite": "Sysmon log",
  "web-access": "Web log",
  firewall: "Firewall log",
  dns: "DNS log",
  vpn: "VPN log",
};

/**
 * What names one moment. A ref alone doesn't: a file record gives up to four moments, one per
 * distinct MACB time. Its ref and its instant together do, because equal times are merged.
 */
export function entryKey(entry: TimelineEntry): string {
  return `${entry.ref}@${entry.at}`;
}

// ---------------------------------------------------------------------------------------------
// Filters

/** What both views show: the sources not switched off, within the brushed range if there is one. */
export interface TimelineFilter {
  readonly hidden: readonly TimelineSource[];
  readonly range?: TimeRange;
}

export interface TimeRange {
  readonly from: Instant;
  readonly to: Instant;
}

export const NO_FILTER: TimelineFilter = { hidden: [] };

/** The entries on a source that isn't hidden. The overview strip draws these. */
export function visibleSources(
  entries: readonly TimelineEntry[],
  hidden: readonly TimelineSource[],
): TimelineEntry[] {
  return hidden.length === 0 ? [...entries] : entries.filter((e) => !hidden.includes(e.source));
}

/** The entries both views list: on a shown source, and inside the range when one is set. */
export function applyFilter(
  entries: readonly TimelineEntry[],
  filter: TimelineFilter,
): TimelineEntry[] {
  const shown = visibleSources(entries, filter.hidden);
  const range = filter.range;
  if (!range) return shown;
  return shown.slice(lowerBound(shown, range.from), upperBound(shown, range.to));
}

/** Every source with at least one entry, in the timeline's source order. */
export function sourcesIn(entries: readonly TimelineEntry[]): TimelineSource[] {
  const present = new Set(entries.map((entry) => entry.source));
  return TIMELINE_SOURCES.filter((source) => present.has(source));
}

// ---------------------------------------------------------------------------------------------
// Moving between moments

/** Index of the first entry at or after `at`. Entries are in time order. */
export function lowerBound(entries: readonly TimelineEntry[], at: Instant): number {
  let lo = 0;
  let hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((entries[mid]?.at ?? Infinity) < at) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Index just past the last entry at or before `at`. */
export function upperBound(entries: readonly TimelineEntry[], at: Instant): number {
  let lo = 0;
  let hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((entries[mid]?.at ?? Infinity) <= at) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The entries on one track, in order. */
export function onTrack(entries: readonly TimelineEntry[], source: TimelineSource) {
  return entries.filter((entry) => entry.source === source);
}

/**
 * The entry `delta` places along `list` from the one keyed `from`, stopping at either end. With no
 * current entry, forward starts at the first and backward at the last.
 */
export function stepFrom(
  list: readonly TimelineEntry[],
  from: string | undefined,
  delta: number,
): TimelineEntry | undefined {
  if (list.length === 0) return undefined;
  const index = from === undefined ? -1 : list.findIndex((entry) => entryKey(entry) === from);
  if (index < 0) return delta >= 0 ? list[0] : list.at(-1);
  return list[Math.max(0, Math.min(list.length - 1, index + delta))];
}

/** The entry in `list` closest in time to `at`; on a tie, the earlier one. */
export function nearestTo(list: readonly TimelineEntry[], at: Instant): TimelineEntry | undefined {
  const index = lowerBound(list, at);
  const after = list[index];
  const before = list[index - 1];
  if (!before) return after;
  if (!after) return before;
  return at - before.at <= after.at - at ? before : after;
}

/**
 * Up or Down: the next track in `tracks` that has entries, `direction` away from `current`, and on
 * it the entry nearest in time to `at`. Undefined at the top or bottom track.
 */
export function changeTrack(
  entries: readonly TimelineEntry[],
  tracks: readonly TimelineSource[],
  current: TimelineSource,
  direction: 1 | -1,
  at: Instant,
): TimelineEntry | undefined {
  for (let i = tracks.indexOf(current) + direction; i >= 0 && i < tracks.length; i += direction) {
    const track = tracks[i];
    const found = track && nearestTo(onTrack(entries, track), at);
    if (found) return found;
  }
  return undefined;
}

/**
 * The entries within `windowMs` either side of `centre`, on every track: what lights up when a
 * moment is chosen. Includes the chosen one.
 */
export function withinWindow(
  entries: readonly TimelineEntry[],
  centre: TimelineEntry,
  windowMs: number,
): TimelineEntry[] {
  return entries.slice(
    lowerBound(entries, centre.at - windowMs),
    upperBound(entries, centre.at + windowMs),
  );
}

/** The choices for how far either side of a chosen moment lights up. */
export const HIGHLIGHT_WINDOWS: readonly { readonly ms: number; readonly label: string }[] = [
  { ms: 10_000, label: "10 seconds" },
  { ms: 60_000, label: "1 minute" },
  { ms: 5 * 60_000, label: "5 minutes" },
  { ms: 30 * 60_000, label: "30 minutes" },
];

export const DEFAULT_HIGHLIGHT_MS = 60_000;

// ---------------------------------------------------------------------------------------------
// Zoom and the axis

export type ZoomLevel = "all" | "hours" | "minutes" | "seconds";

/**
 * Hour, then minute, then second (09 §The view), after the whole case. Each fixed level is the
 * width of time the tracks show, centred on the moment you're on.
 */
export const ZOOM_LEVELS: readonly {
  readonly id: ZoomLevel;
  readonly label: string;
  readonly spanMs?: number;
}[] = [
  { id: "all", label: "Whole range" },
  { id: "hours", label: "Hours", spanMs: 6 * 3_600_000 },
  { id: "minutes", label: "Minutes", spanMs: 10 * 60_000 },
  { id: "seconds", label: "Seconds", spanMs: 30_000 },
];

/** One step in (+1) or out (−1), stopping at either end. */
export function zoomStep(level: ZoomLevel, direction: 1 | -1): ZoomLevel {
  const index = ZOOM_LEVELS.findIndex((zoom) => zoom.id === level);
  const next = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index + direction))];
  return next?.id ?? level;
}

export function zoomLabel(level: ZoomLevel): string {
  return ZOOM_LEVELS.find((zoom) => zoom.id === level)?.label ?? level;
}

/** The first and last instant in `entries`, or undefined for none. */
export function extentOf(entries: readonly TimelineEntry[]): TimeRange | undefined {
  const first = entries[0];
  const last = entries.at(-1);
  return first && last ? { from: first.at, to: last.at } : undefined;
}

/** A stretch too short to draw across gets this much either side, so its moments spread out. */
const MIN_HALF_SPAN_MS = 30_000;

/**
 * The stretch of time the tracks show. "Whole range" fits `extent` with a little room at each end;
 * a fixed level is its span, centred on `centre`.
 */
export function viewportFor(level: ZoomLevel, extent: TimeRange, centre: Instant): TimeRange {
  const span = ZOOM_LEVELS.find((zoom) => zoom.id === level)?.spanMs;
  if (span === undefined) {
    const width = extent.to - extent.from;
    if (width < MIN_HALF_SPAN_MS * 2) {
      const middle = extent.from + width / 2;
      return { from: middle - MIN_HALF_SPAN_MS, to: middle + MIN_HALF_SPAN_MS };
    }
    const pad = width * 0.02;
    return { from: extent.from - pad, to: extent.to + pad };
  }
  return { from: centre - span / 2, to: centre + span / 2 };
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Tick spacings the axis picks from. */
const TICK_STEPS = [
  SECOND,
  5 * SECOND,
  10 * SECOND,
  30 * SECOND,
  MINUTE,
  5 * MINUTE,
  10 * MINUTE,
  30 * MINUTE,
  HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  7 * DAY,
  30 * DAY,
  365 * DAY,
];

export interface Tick {
  readonly at: Instant;
  readonly label: string;
}

/**
 * Axis ticks across `viewport`, at most about `maxTicks` of them, on round UTC times. Labels are
 * UTC: the axis is the real moment, whichever clock the entries are shown on.
 */
export function ticksFor(viewport: TimeRange, maxTicks: number): Tick[] {
  const span = viewport.to - viewport.from;
  if (!(span > 0) || maxTicks < 1) return [];
  const step = TICK_STEPS.find((candidate) => span / candidate <= maxTicks) ?? span;
  const ticks: Tick[] = [];
  for (let at = Math.ceil(viewport.from / step) * step; at <= viewport.to; at += step) {
    ticks.push({ at, label: tickLabel(at, step) });
  }
  return ticks;
}

function tickLabel(at: Instant, step: number): string {
  const iso = new Date(at).toISOString();
  if (step >= DAY) return iso.slice(0, 10);
  if (step >= MINUTE) return at % DAY === 0 ? iso.slice(5, 10) : iso.slice(11, 16);
  return iso.slice(11, 19);
}

/**
 * How many entries fall in each of `bins` equal slices of `range`: the overview strip's shape.
 */
export function density(
  entries: readonly TimelineEntry[],
  range: TimeRange,
  bins: number,
): number[] {
  const counts = new Array<number>(Math.max(0, bins)).fill(0);
  const span = range.to - range.from;
  if (bins < 1 || !(span > 0)) return counts;
  for (const entry of entries) {
    const bin = Math.floor(((entry.at - range.from) / span) * bins);
    if (bin >= 0 && bin < bins) counts[bin] = (counts[bin] ?? 0) + 1;
    else if (bin === bins) counts[bins - 1] = (counts[bins - 1] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------------------------
// Words

/** An entry's time as the tool prints it: UTC, or on its own source's clock. */
export function entryTime(set: EvidenceSet, entry: TimelineEntry, local: boolean): string {
  return timelineTime(entry.at, local ? sourceZone(set, entry.source) : undefined);
}

const MACB_WORDS: Readonly<Record<string, string>> = {
  M: "modified",
  A: "accessed",
  C: "changed (the record itself)",
  B: "born",
};

/** What an entry's kind means, in a sentence. */
export function describeKind(entry: TimelineEntry): string {
  if (isMacbKind(entry.kind)) {
    const words = [...entry.kind].filter((c) => c !== ".").map((c) => MACB_WORDS[c] ?? c);
    return `The file was ${joinWords(words)} at this moment.`;
  }
  if (entry.kind === "process-start") return "A program started.";
  if (entry.kind === "connection") return "A network connection was opened.";
  if (/^\d+$/.test(entry.kind)) return `The event id the ${TRACK_LABELS[entry.source]} gave it.`;
  return `The word the ${TRACK_LABELS[entry.source]} record leads with.`;
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** One line a screen reader can say for an entry. */
export function entrySentence(set: EvidenceSet, entry: TimelineEntry, local: boolean): string {
  return `${TRACK_LABELS[entry.source]}, ${entryTime(set, entry, local)}, ${entry.kind}: ${entry.summary}`;
}

// ---------------------------------------------------------------------------------------------
// The zone banner

export interface ZonedTrack {
  readonly source: TimelineSource;
  readonly zone: string;
  /** "UTC+01:00", or "UTC+00:00 or UTC+01:00, by date" when the entries span a change. */
  readonly offsets: string;
}

/**
 * The tracks whose machines kept local time, with the offsets their entries were recorded at, and
 * the ones in UTC. The banner shows only when the two lists are both non-empty or the local zones
 * differ: when sources use different zones (09 §The view).
 */
export function zoneTracks(
  set: EvidenceSet,
  entries: readonly TimelineEntry[],
  tracks: readonly TimelineSource[],
): { zoned: ZonedTrack[]; utc: TimelineSource[]; mixed: boolean } {
  const zoned: ZonedTrack[] = [];
  const utc: TimelineSource[] = [];
  for (const source of tracks) {
    const zone = sourceZone(set, source);
    const offsets = new Set<string>();
    if (zone !== UTC_ZONE) {
      for (const entry of entries) {
        const period = entry.source === source ? zonePeriodAt(zone, entry.at) : undefined;
        if (period) offsets.add(`UTC${formatOffset(period.offsetMinutes)}`);
      }
    }
    if (offsets.size === 0) utc.push(source);
    else {
      const list = [...offsets];
      zoned.push({
        source,
        zone,
        offsets: list.length === 1 ? list.join("") : `${list.join(" or ")}, by date`,
      });
    }
  }
  const zones = new Set(zoned.map((track) => track.zone));
  const mixed = zones.size + (utc.length > 0 ? 1 : 0) > 1;
  return { zoned, utc, mixed };
}

/** A list read aloud: "a", "a and b", "a, b and c". */
export function listWords(words: readonly string[]): string {
  return joinWords(words);
}
