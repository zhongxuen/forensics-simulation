/**
 * timeline: every moment in the evidence, from every source, in one list.
 *
 * `buildTimeline` (src/sim/evidence/timeline.ts) does the merging; this prints it, one line per
 * moment in a pipe-separated format written from scratch (`time | source | kind | host | summary`),
 * each line carrying its artefact's ref. `--around` is the teaching move: everything within a few
 * minutes of one moment you have already found (docs/plan/09-timeline.md §The tool).
 *
 * Disks are read the way every disk tool reads them (`openImage`): a working copy if there is one,
 * otherwise the original through its write-blocker, so a timeline taken with the blocker off shows
 * the access times that read has changed.
 */
import { errorLine, failure, plural, stderr, stdout } from "../../core/output";
import type { SimError } from "../../core/errors";
import type { OutputLine, SimEvent, SimResult, SimState } from "../../core/types";
import { parseRef, resolveRef } from "../../evidence/refs";
import {
  buildTimeline,
  isMacbKind,
  TIMELINE_SOURCES,
  type TimelineEntry,
  type TimelineSource,
} from "../../evidence/timeline";
import {
  formatInstant,
  formatOffset,
  pad2,
  UTC_ZONE,
  zonedParts,
  zonePeriodAt,
} from "../../evidence/time";
import type { DiskImage, EvidenceSet, Instant } from "../../evidence/types";
import { optionValue, parseArgs, type ParsedArgs } from "../args";
import type { Tool, ToolContext } from "../types";
import {
  banner,
  delivered,
  findImage,
  openImage,
  requireEvidence,
  workstationFs,
  ZONE_OPTION,
} from "./shared";

const NAME = "timeline";

/** How far either side of the `--around` moment to look when no `--window` is given. */
const DEFAULT_WINDOW_MS = 5 * 60_000;
/** A window wider than a day is a whole-case timeline; use --from and --to for that. */
const MAX_WINDOW_MS = 24 * 3_600_000;

const OPTIONS = [
  { names: ["--from"], key: "from", takesValue: true },
  { names: ["--to"], key: "to", takesValue: true },
  { names: ["--source"], key: "source", takesValue: true },
  { names: ["--around"], key: "around", takesValue: true },
  { names: ["--window"], key: "window", takesValue: true },
  ZONE_OPTION,
];

export const timeline: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner: "put every moment in the evidence, from every source, into one list in time order.",
    usage: [
      "timeline [--from <time>] [--to <time>] [--source <s,…>] [--zone local]",
      "timeline --around <ref|time> [--window 5m]",
    ],
    description: [
      "A timeline is every moment the evidence remembers, in the order it happened: a file changing on the laptop's drive, a program starting in memory, a sign-in in the security log, a request in the web server's log. Each tool so far showed one source at a time. This one merges them.",
      "Each line reads time | source | kind | host | summary, then the ref of the piece of evidence it came from. The source says where the moment was found. The kind says what happened: for a file it is its MACB letters (modified, accessed, changed, born) with a dot for each time that sits on another line, so M.C. means the content and the record changed at that second. For a memory image it is process-start or connection. For a Windows-style log it is the event id, such as 4624 for a sign-in.",
      "--around is the one to reach for first. Give it the ref of something you have already found, and it shows everything that happened within five minutes of it, on every source. That is how one clue turns into a story: what ran in the minute before the file was deleted, who signed in right after.",
      "Times are in UTC unless you pass --zone local. The order is always by the real moment, whatever the clock on screen says.",
    ],
    options: [
      {
        flags: "--from <time>",
        text: "Start here. 2026-04-11, 2026-04-11T19:40 or 2026-04-11T20:40+01:00. A time with no zone is read as UTC.",
      },
      { flags: "--to <time>", text: "Stop here, including this moment." },
      {
        flags: "--source <s,…>",
        text: `Only these sources: ${TIMELINE_SOURCES.join(", ")}.`,
      },
      {
        flags: "--around <ref|time>",
        text: "Everything within a window either side of one moment: a ref from any tool's output, or a time.",
      },
      { flags: "--window <n>s|m|h", text: "How far either side --around looks. Default 5m." },
      {
        flags: "--zone <utc|local>",
        text: "Show times in UTC (the default) or as each source's own machine showed them.",
      },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      { command: "timeline", text: "Every moment in the case, oldest first." },
      {
        command: "timeline --around disk:qf-lt-07:mft/51",
        text: "Everything within five minutes of the moment record 51 changed.",
      },
      {
        command: "timeline --around log:security/57 --window 30s --source security,disk",
        text: "The half minute either side of a sign-in, in the security log and on the drive.",
      },
      {
        command: "timeline --from 2026-04-11T19:30 --to 2026-04-11T20:00 --zone local",
        text: "Half an hour, in the clock times each machine showed.",
      },
    ],
    concept: [
      "Most of an investigation is putting moments side by side. On its own, a deleted file is a deleted file. Next to a sign-in from an address outside the office thirty seconds earlier, it is the start of an explanation.",
      "Time zones are where timelines most often mislead. Every moment here is stored in UTC, but a laptop in the UK showed its owner British time, and a witness, a screenshot or an email will name that hour. Mixing the two moves events an hour apart, which can put a person at a keyboard they had already left. Keep one zone while you work, and say which one in the report.",
      "A timeline shows what happened when, not why. Two things close together are worth a look, not proof that one caused the other. The finding comes from what the records say, checked against each other.",
    ],
    realWorld: [
      "Plaso's log2timeline, which extracts timestamped events from an image into a storage file, and psort, which filters and prints them (psort's --slice option looks around one moment, like --around).",
      "Autopsy's Timeline view, with its per-source tracks and zoom.",
      "Timesketch, where a team reviews and annotates a Plaso timeline together.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, OPTIONS);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [extra] = parsed.value.positionals;
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "option", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const query = readQuery(parsed.value);
    if (!query.ok) return refuse(state, query.error, query.explain);

    const session = requireEvidence(state);
    if (!session.ok) return failure(NAME, session.error, state);

    // Read every disk the way the disk tools do: the working copy, or the original through its
    // write-blocker. The rest of the set (memory, logs) is data that no read can change.
    let current = state;
    const events: SimEvent[] = [];
    const warnings: string[][] = [];
    const disks: DiskImage[] = [];
    for (const disk of session.value.set.disks) {
      const opened = openDisk(current, disk, ctx);
      current = opened.state;
      events.push(...opened.events);
      if (opened.warning) warnings.push([...opened.warning]);
      disks.push(opened.image);
    }
    const set: EvidenceSet = { ...session.value.set, disks };
    const all = buildTimeline(set);

    const around =
      query.value.around === undefined ? undefined : centre(set, all, query.value.around);
    if (around && !around.ok) return refuse(current, around.error, around.explain, events);

    let from = query.value.from;
    let to = query.value.to;
    if (around?.ok) {
      from = Math.max(from ?? -Infinity, around.value.at - query.value.window);
      to = Math.min(to ?? Infinity, around.value.at + query.value.window);
    }
    const sources = query.value.sources;
    const shown = all.filter(
      (entry) =>
        (sources === undefined || sources.has(entry.source)) &&
        (from === undefined || entry.at >= from) &&
        (to === undefined || entry.at <= to),
    );

    const output: OutputLine[] = [
      banner(NAME, ...scope(set, sources), plural(shown.length, "moment")),
      stdout(""),
      ...query.value.notes.map((note) => stdout(`  ${note}`)),
      ...(around?.ok ? aroundLines(around.value, query.value.window) : []),
      ...(query.value.notes.length > 0 || around?.ok ? [stdout("")] : []),
    ];
    if (shown.length === 0) {
      output.push(...emptyLines(all.length, around?.ok === true, sources !== undefined));
    } else {
      output.push(
        ...zoneLines(set, shown, query.value.local),
        ...entryLines(set, shown, query.value.local),
        stdout(""),
        ...legendLines(shown),
        stdout("  Pin a moment with: pin <line number>, or pin on its own for the last one."),
      );
    }
    for (const warning of warnings) output.push(stdout(""), ...warning.map(stdout));
    return delivered(current, [NAME, ...args].join(" "), output, events);
  },
};

// ---------------------------------------------------------------------------------------------
// Options

interface Query {
  readonly from?: Instant;
  readonly to?: Instant;
  readonly sources?: ReadonlySet<TimelineSource>;
  readonly around?: string;
  readonly window: number;
  readonly local: boolean;
  /** Plain-language lines about how an option was read, printed above the timeline. */
  readonly notes: readonly string[];
}

/** A refusal: the typed error, plus the beginner lines that say what to do instead. */
type Checked<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SimError; readonly explain: readonly string[] };

const good = <T>(value: T): Checked<T> => ({ ok: true, value });
const bad = <T>(error: SimError, ...explain: string[]): Checked<T> => ({
  ok: false,
  error,
  explain,
});

function readQuery(parsed: ParsedArgs): Checked<Query> {
  const notes: string[] = [];

  const zone = optionValue(parsed, "zone")?.toLowerCase() ?? "utc";
  if (zone !== "utc" && zone !== "local") {
    return bad({ code: "BAD_ARGUMENT", argument: "--zone", value: zone, reason: "unknown-value" });
  }

  const times: Record<"from" | "to", Instant | undefined> = { from: undefined, to: undefined };
  for (const key of ["from", "to"] as const) {
    const value = optionValue(parsed, key);
    if (value === undefined) continue;
    const time = parseTime(value);
    if (!time) {
      return bad(
        { code: "BAD_ARGUMENT", argument: `--${key}`, value, reason: "bad-format" },
        "Write a time like 2026-04-11T19:40 (read as UTC), 2026-04-11T19:40Z, or",
        "2026-04-11T20:40+01:00 for a local time with its offset. A date on its own means midnight UTC.",
      );
    }
    times[key] = time.at;
    if (!time.zoned) notes.push(`--${key} ${value} has no zone, so it was read as UTC.`);
  }
  if (times.from !== undefined && times.to !== undefined && times.to < times.from) {
    return bad(
      {
        code: "BAD_ARGUMENT",
        argument: "--to",
        value: optionValue(parsed, "to") ?? "",
        reason: "out-of-range",
      },
      "--to is earlier than --from, so nothing could fall between them. Swap the two times.",
    );
  }

  let sources: Set<TimelineSource> | undefined;
  const sourceList = optionValue(parsed, "source");
  if (sourceList !== undefined) {
    sources = new Set();
    for (const word of sourceList.split(",")) {
      const source = word.trim().toLowerCase();
      if (!isTimelineSource(source)) {
        return bad(
          { code: "BAD_ARGUMENT", argument: "--source", value: word, reason: "unknown-value" },
          `The sources are: ${TIMELINE_SOURCES.join(", ")}. Separate several with commas, no spaces.`,
        );
      }
      sources.add(source);
    }
  }

  let window = DEFAULT_WINDOW_MS;
  const windowText = optionValue(parsed, "window");
  if (windowText !== undefined) {
    const ms = parseWindow(windowText);
    if (ms === undefined) {
      return bad(
        { code: "BAD_ARGUMENT", argument: "--window", value: windowText, reason: "bad-format" },
        "A window is a number and a unit: 30s, 5m or 2h.",
      );
    }
    if (ms === 0 || ms > MAX_WINDOW_MS) {
      return bad(
        { code: "BAD_ARGUMENT", argument: "--window", value: windowText, reason: "out-of-range" },
        "A window runs from 1s to 24h. For a longer stretch, use --from and --to.",
      );
    }
    window = ms;
  }

  const around = optionValue(parsed, "around");
  if (around === undefined && windowText !== undefined) {
    notes.push("--window only matters with --around, so it was left out.");
  }
  return good({
    ...(times.from === undefined ? {} : { from: times.from }),
    ...(times.to === undefined ? {} : { to: times.to }),
    ...(sources ? { sources } : {}),
    ...(around === undefined ? {} : { around }),
    window,
    local: zone === "local",
    notes,
  });
}

function isTimelineSource(value: string): value is TimelineSource {
  return (TIMELINE_SOURCES as readonly string[]).includes(value);
}

const TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:\d{2})?$/i;

/**
 * A time as a player would type it. With no zone it is UTC, never the machine's zone: the engine
 * has no zone of its own, and saying so out loud is part of the lesson.
 */
export function parseTime(text: string): { at: Instant; zoned: boolean } | undefined {
  const match = TIME.exec(text.trim());
  if (!match) return undefined;
  const [, y = "", mo = "", d = "", h = "00", mi = "00", s = "00", zone] = match;
  const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) {
    return undefined;
  }
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  // Date.UTC rolls 31 April over into May; a date that doesn't exist isn't a date.
  if (new Date(wall).getUTCDate() !== day) return undefined;
  if (zone === undefined || zone.toUpperCase() === "Z") {
    return { at: wall, zoned: zone !== undefined };
  }
  const sign = zone.startsWith("-") ? -1 : 1;
  const offset = sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
  if (Math.abs(offset) > 14 * 60) return undefined;
  return { at: wall - offset * 60_000, zoned: true };
}

/** "30s", "5m", "2h" in milliseconds, or undefined. */
export function parseWindow(text: string): number | undefined {
  const match = /^(\d{1,6})([smh])$/i.exec(text.trim());
  if (!match) return undefined;
  const unit = { s: 1_000, m: 60_000, h: 3_600_000 }[(match[2] ?? "s").toLowerCase() as "s"];
  return Number(match[1]) * unit;
}

// ---------------------------------------------------------------------------------------------
// --around

interface Centre {
  readonly at: Instant;
  /** The entry the window is centred on, when --around named a ref. */
  readonly entry?: TimelineEntry;
  /** The ref's other moments, when it has more than one (a file's MACB times). */
  readonly others: readonly TimelineEntry[];
}

function centre(set: EvidenceSet, all: readonly TimelineEntry[], value: string): Checked<Centre> {
  const time = parseTime(value);
  if (time) return good({ at: time.at, others: [] });

  const parsed = parseRef(value);
  if (!parsed) {
    return bad(
      { code: "BAD_ARGUMENT", argument: "--around", value, reason: "bad-format" },
      "--around takes a ref, such as disk:qf-lt-07:mft/51 or log:security/57, or a time such",
      "as 2026-04-11T19:40Z. Every evidence tool prints refs beside what it shows.",
    );
  }
  if (!resolveRef(set, value)) {
    return bad(
      { code: "BAD_ARGUMENT", argument: "--around", value, reason: "unknown-value" },
      "Nothing in this case's evidence has that ref. Copy one from a line of timeline,",
      "lsfs or inode output, where each piece of evidence prints its own.",
    );
  }
  const moments = all.filter((entry) => entry.ref === value);
  if (moments.length === 0 && (parsed.kind === "carve" || parsed.kind === "region")) {
    const what = parsed.kind === "carve" ? "A carved object" : "A memory region";
    const instead = parsed.kind === "carve" ? "the file record it came from" : "its process";
    return bad(
      { code: "BAD_ARGUMENT", argument: "--around", value, reason: "unknown-value" },
      `${what} has no time of its own, so it isn't on the timeline. Try ${instead} instead.`,
    );
  }
  // A file record can have up to four moments. Centre on the one where its content changed: that
  // is nearly always the moment an investigation cares about.
  const entry = moments.find((m) => isMacbKind(m.kind) && m.kind.startsWith("M")) ?? moments[0];
  if (!entry)
    return bad({ code: "BAD_ARGUMENT", argument: "--around", value, reason: "unknown-value" });
  return good({ at: entry.at, entry, others: moments.filter((m) => m !== entry) });
}

function aroundLines(around: Centre, window: number): OutputLine[] {
  const span = describeWindow(window);
  const time = formatInstant(around.at);
  if (!around.entry) {
    return [stdout(`  Everything within ${span} either side of ${time}.`)];
  }
  const { entry } = around;
  const lines: OutputLine[] = [
    {
      stream: "stdout",
      text: `  Everything within ${span} either side of ${entry.ref}, ${entry.kind} at ${time}.`,
      ref: entry.ref,
    },
  ];
  if (around.others.length > 0) {
    const others = around.others.map((m) => `${m.kind} ${formatInstant(m.at)}`).join(", ");
    lines.push(
      stdout(`  It has other moments too (${others}).`),
      stdout("  Pass one of those times to --around to look there instead."),
    );
  }
  return lines;
}

function describeWindow(ms: number): string {
  if (ms % 3_600_000 === 0) return plural(ms / 3_600_000, "hour");
  if (ms % 60_000 === 0) return plural(ms / 60_000, "minute");
  return plural(ms / 1_000, "second");
}

// ---------------------------------------------------------------------------------------------
// Output

/** The zone a source recorded its times in, as the evidence set says: absent means UTC. */
export function sourceZone(set: EvidenceSet, source: TimelineSource): string {
  if (source === "memory") return UTC_ZONE;
  return set.zones[source] ?? UTC_ZONE;
}

/**
 * One moment, as the timeline prints it. UTC is ISO 8601 with a Z; local time is the wall clock
 * with its offset, and UTC sources read "+00:00" beside them so the column lines up.
 *
 * A moment the offset table doesn't cover (a file from the year the laptop was set up, say) is
 * printed in UTC, with its Z, rather than with an offset the engine would have to guess.
 */
export function timelineTime(at: Instant, zone: string | undefined): string {
  if (zone === undefined || !zonePeriodAt(zone, at)) return formatInstant(at);
  const p = zonedParts(at, zone);
  return (
    `${p.year}-${pad2(p.month)}-${pad2(p.day)} ` +
    `${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)} ${formatOffset(p.offsetMinutes)}`
  );
}

function scope(set: EvidenceSet, sources: ReadonlySet<TimelineSource> | undefined): string[] {
  const present = new Set<TimelineSource>([
    ...(set.disks.length > 0 ? (["disk"] as const) : []),
    ...(set.memory.length > 0 ? (["memory"] as const) : []),
    ...set.logs.map((record) => record.source),
  ]);
  const used = TIMELINE_SOURCES.filter((s) => present.has(s) && (!sources || sources.has(s)));
  return [plural(used.length, "source")];
}

function entryLines(
  set: EvidenceSet,
  entries: readonly TimelineEntry[],
  local: boolean,
): OutputLine[] {
  const rows = entries.map((entry) => [
    timelineTime(entry.at, local ? sourceZone(set, entry.source) : undefined),
    entry.source,
    entry.kind,
    entry.host,
  ]);
  const header = [local ? "Time (each source's own zone)" : "Time (UTC)", "Source", "Kind", "Host"];
  const widths = header.map((title, i) =>
    Math.max(title.length, ...rows.map((row) => (row[i] ?? "").length)),
  );
  const line = (cells: readonly string[], summary: string) =>
    `  ${cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join(" | ")} | ${summary}`;
  return [
    stdout(line(header, "Summary")),
    ...entries.map((entry, i): OutputLine => ({
      stream: "stdout",
      text: `${line(rows[i] ?? [], entry.summary)}  [${entry.ref}]`,
      ref: entry.ref,
    })),
  ];
}

/**
 * The zone banner (docs/plan/09-timeline.md §The view): which sources kept local time, so nobody
 * reads a UTC hour as the hour on the laptop's own clock, or compares two local clocks by eye.
 */
function zoneLines(
  set: EvidenceSet,
  shown: readonly TimelineEntry[],
  local: boolean,
): OutputLine[] {
  const zoned: { source: TimelineSource; zone: string; offset: string }[] = [];
  for (const source of TIMELINE_SOURCES) {
    const zone = sourceZone(set, source);
    if (zone === UTC_ZONE) continue;
    // Every offset the shown moments were recorded with: a UK machine is +00:00 in winter and
    // +01:00 in summer, and naming only one would mislead about the other.
    const offsets = new Set<string>();
    for (const entry of shown) {
      const period = entry.source === source ? zonePeriodAt(zone, entry.at) : undefined;
      if (period) offsets.add(`UTC${formatOffset(period.offsetMinutes)}`);
    }
    if (offsets.size === 0) continue;
    const offset =
      offsets.size === 1 ? [...offsets].join("") : `${[...offsets].join(" or ")}, by date`;
    zoned.push({ source, zone, offset });
  }
  if (zoned.length === 0) return [];
  const uncovered = shown.some((entry) => {
    const zone = sourceZone(set, entry.source);
    return zone !== UTC_ZONE && !zonePeriodAt(zone, entry.at);
  });
  const width = Math.max(...zoned.map((z) => z.source.length));
  const list = zoned.map((z) => stdout(`    ${z.source.padEnd(width)}  ${z.zone} (${z.offset})`));
  if (!local) {
    return [
      stdout("  These times are UTC. These sources showed local time on their own machines:"),
      ...list,
      stdout("  Pass --zone local to see each one as its own machine did."),
      stdout(""),
    ];
  }
  const mixed = new Set(shown.map((entry) => sourceZone(set, entry.source))).size > 1;
  return [
    stdout("  Each line shows the time its own source's machine showed:"),
    ...list,
    ...(mixed
      ? [
          stdout(
            "  The rest are UTC. Two lines can show different clock times for the same moment,",
          ),
          stdout(
            "  so compare the offsets, not the hours. The order is always by the real moment.",
          ),
        ]
      : []),
    ...(uncovered
      ? [
          stdout("  A few moments are older than the dates this workstation has zone rules for,"),
          stdout("  so they stay in UTC: those are the times ending in Z."),
        ]
      : []),
    stdout(""),
  ];
}

function legendLines(shown: readonly TimelineEntry[]): OutputLine[] {
  const lines: OutputLine[] = [];
  if (shown.some((entry) => entry.source === "disk")) {
    lines.push(
      stdout("  For a file, the kind is its MACB times: M modified, A accessed, C changed (the"),
      stdout(
        "  record itself), B born. A dot means that time is on another line; MACB is all four.",
      ),
    );
  }
  return lines;
}

function emptyLines(total: number, around: boolean, filtered: boolean): OutputLine[] {
  if (total === 0) {
    return [
      stdout("  The timeline will list every moment in this case's evidence. This evidence has"),
      stdout("  no times in it yet. Open a case with a drive, memory or logs to fill it."),
    ];
  }
  const tryNext = around
    ? "Try a wider --window, such as 30m"
    : "Try a wider range with --from and --to";
  return [
    stdout("  Nothing happened in that stretch of time on these sources. The evidence holds"),
    stdout(
      `  ${plural(total, "moment")} in all, none of them here. ${tryNext}${filtered ? ", or drop --source" : ""}.`,
    ),
  ];
}

// ---------------------------------------------------------------------------------------------
// Plumbing

function openDisk(
  state: SimState,
  disk: DiskImage,
  ctx: ToolContext,
): { state: SimState; image: DiskImage; events: readonly SimEvent[]; warning?: readonly string[] } {
  const session = state.evidence;
  if (!session) return { state, image: disk, events: [] };
  const fs = workstationFs(state, ctx);
  const target = findImage(session, fs.vfs, fs.ctx, disk.id);
  // A disk in the set with nowhere attached is read as handed over.
  if (!target.ok) return { state, image: disk, events: [] };
  const opened = openImage(state, target.value, NAME, ctx.now);
  return {
    state: opened.state,
    image: opened.view.image,
    events: opened.events,
    ...(opened.warning ? { warning: opened.warning } : {}),
  };
}

/** A refusal with the lines that say what to do instead, after the realistic error line. */
function refuse(
  state: SimState,
  error: SimError,
  explain: readonly string[],
  events: readonly SimEvent[] = [],
): SimResult {
  if (explain.length === 0) return failure(NAME, error, state, events);
  const result = failure(NAME, error, state, events);
  const [first, ...rest] = result.output;
  return {
    ...result,
    output: [first ?? errorLine(NAME, error), ...explain.map(stderr), ...rest],
  };
}
