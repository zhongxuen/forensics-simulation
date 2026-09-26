/**
 * logq: filters and counts the log records a case hands over (docs/plan/07-carve-strings-logq.md).
 *
 * Every matching record is printed in its source's own shape (`renderLog`), with the record's ref
 * on each of its lines, so any line that survives a `| grep` can still be pinned. `--count-by`
 * turns the records into a small table instead, which is where a burst shows up: forty failed
 * logons from one address reads very differently from one.
 */
import { columns, failure, plural, stdout } from "../../core/output";
import type { SimError } from "../../core/errors";
import type { OutputLine } from "../../core/types";
import { renderLog } from "../../evidence/logs";
import { formatRef, isLogSource } from "../../evidence/refs";
import { formatInstant, UTC_ZONE } from "../../evidence/time";
import type { EvidenceSet, Instant, LogRecord, LogSource } from "../../evidence/types";
import { LOG_SOURCES } from "../../evidence/types";
import { parseArgs } from "../args";
import type { Tool } from "../types";
import { banner, delivered, requireEvidence, ZONE_OPTION } from "./shared";

const NAME = "logq";

/** A `--where` condition: a field (or property) and the value it must have. */
interface Condition {
  readonly field: string;
  readonly value: string;
  /** As typed, for the event and the banner. */
  readonly typed: string;
}

export const logq: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner: "filter the case's log records, or count them by any field.",
    usage: [
      "logq [--source <s>] [--id <n>] [--from <time>] [--to <time>] [--where <field>=<value>]...",
      "logq ... --count-by <field>",
    ],
    description: [
      "A log is a list of records, each one a note a computer wrote when something happened: a sign-in, a new process, a blocked connection. A case can hand over thousands, from several sources. logq picks out the ones you ask for and prints each in its source's own format.",
      "--source picks one source: security, sysmon-lite, web-access, firewall, dns or vpn. --id picks one event id, the number Windows gives each kind of event: 4624 is a successful logon, 4625 one that did not succeed. --from and --to keep records inside a time window.",
      "--where keeps records whose field has that exact value, such as --where IpAddress=10.60.0.21. Field names are the ones printed in the records; source, host and id work too. Give --where more than once and a record must match them all.",
      "--count-by prints a table instead: each value of a field, how many records have it, and the first and last time it appears. It is the fastest way to see a pattern, such as one address trying over and over.",
      "Times are written like 2026-04-11T19:40:00Z. A time with no Z or offset is read as UTC. Records print in UTC unless --zone local, which shows each source the way its own computer displayed it.",
    ],
    options: [
      {
        flags: "--source <name>",
        text: "Only this source: security, sysmon-lite, web-access, firewall, dns or vpn.",
      },
      { flags: "--id <n>", text: "Only this event id, such as 4625." },
      { flags: "--from <time>", text: "Only records at or after this time." },
      { flags: "--to <time>", text: "Only records at or before this time." },
      {
        flags: "--where <field>=<value>",
        text: "Only records whose field has exactly this value. Capital letters don't matter.",
      },
      {
        flags: "--count-by <field>",
        text: "Count the matching records by one field, instead of printing them.",
      },
      {
        flags: "--zone <utc|local>",
        text: "Show times in UTC (the default) or as each source's computer showed them.",
      },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      {
        command: "logq --source security --id 4625 --count-by IpAddress",
        text: "Where the logons that did not succeed came from, and how many from each.",
      },
      {
        command: "logq --source security --id 4625 | grep 10.60.0.21",
        text: "The same records, narrowed with grep. Every line it keeps can still be pinned.",
      },
      {
        command: "logq --id 4624 --where LogonType=10 --from 2026-04-11T18:00Z",
        text: "Remote desktop logons since six in the evening, UTC.",
      },
    ],
    concept: [
      "Logs are where an attacker's time on a machine becomes visible: every sign-in, every new account, every connection leaves a record. The work is finding the few records that matter among the many that don't.",
      "Counting comes before reading. A single logon that did not succeed is someone mistyping a password; forty from one address in five minutes is someone guessing. --count-by shows that difference in one command.",
      "Check the zone before comparing times. Two sources can record the same moment an hour apart on screen if one shows local time, which is why logq prints UTC unless you ask otherwise.",
    ],
    realWorld: [
      "Windows Event Viewer's Filter Current Log (event ids, sources, time range), and Get-WinEvent -FilterHashtable in PowerShell.",
      "grep, awk and sort | uniq -c over text logs, the classic way to count by a field.",
      "A SIEM query in Splunk (stats count by src_ip), Elastic or Microsoft Sentinel (summarize count() by IpAddress).",
    ],
    lesson: "logs-windows-logon-events",
  },

  run(args, state) {
    const { conditions, rest } = takeWhere(args);
    const parsed = parseArgs(rest, [
      { names: ["--source", "-s"], key: "source", takesValue: true },
      { names: ["--id"], key: "id", takesValue: true },
      { names: ["--from"], key: "from", takesValue: true },
      { names: ["--to"], key: "to", takesValue: true },
      { names: ["--count-by"], key: "countBy", takesValue: true },
      ZONE_OPTION,
    ]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [extra] = parsed.value.positionals;
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "option", value: extra, reason: "extra-argument" },
        state,
      );
    }
    if (!conditions.ok) return failure(NAME, conditions.error, state);

    const filter = readFilter(parsed.value.options);
    if (!filter.ok) return failure(NAME, filter.error, state);
    const session = requireEvidence(state);
    if (!session.ok) return failure(NAME, session.error, state);
    const set = session.value.set;
    const command = [NAME, ...args].join(" ");

    const { source, id, from, to, countBy, local } = filter.value;
    const matched = [...set.logs]
      .filter((record) => source === undefined || record.source === source)
      .filter((record) => id === undefined || record.eventId === id)
      .filter((record) => from === undefined || record.at >= from)
      .filter((record) => to === undefined || record.at <= to)
      .filter((record) => conditions.value.every((c) => matches(record, c)))
      .sort(
        (x, y) =>
          x.at - y.at ||
          LOG_SOURCES.indexOf(x.source) - LOG_SOURCES.indexOf(y.source) ||
          x.seq - y.seq,
      );

    const scope = [
      source ?? "every source",
      ...(id === undefined ? [] : [`event ${id}`]),
      ...conditions.value.map((c) => c.typed),
    ];
    const output: OutputLine[] = [
      banner(
        NAME,
        `${matched.length} of ${plural(set.logs.length, "record")}`,
        scope.join(", "),
        countBy === undefined
          ? local
            ? "times as each source showed them"
            : "times in UTC"
          : `counted by ${countBy}`,
      ),
      stdout(""),
    ];

    if (set.logs.length === 0) {
      output.push(
        stdout("This case's evidence has no log records. It holds disk or memory images only."),
        stdout("Start with those instead: lsfs, carve and strings read a disk image."),
      );
    } else if (matched.length === 0) {
      output.push(
        stdout("No records matched. Every filter has to match at once, so one that is too narrow"),
        stdout("empties the list. Try again with one filter fewer, or count what there is with:"),
        stdout(`  logq${source === undefined ? "" : ` --source ${source}`} --count-by id`),
      );
    } else if (countBy !== undefined) {
      const again = [
        NAME,
        ...(source === undefined ? [] : [`--source ${source}`]),
        ...(id === undefined ? [] : [`--id ${id}`]),
        ...conditions.value.map((c) => `--where ${c.typed}`),
      ].join(" ");
      output.push(...countTable(matched, countBy, again, local ? set : undefined));
    } else {
      output.push(...recordLines(matched, local ? set : undefined));
      output.push(
        stdout(
          matched.length === 1
            ? "1 record."
            : `${plural(matched.length, "record")}. Narrow them with --where, or count them with --count-by <field>.`,
        ),
      );
    }

    return delivered(state, command, output, [
      {
        type: "logs.queried",
        matched: matched.length,
        total: set.logs.length,
        ...(source === undefined ? {} : { source }),
        ...(id === undefined ? {} : { eventId: id }),
        ...(conditions.value.length === 0
          ? {}
          : { where: conditions.value.map((c) => c.typed).join(" and ") }),
        ...(countBy === undefined ? {} : { countBy }),
      },
    ]);
  },
};

interface Filter {
  readonly source?: LogSource;
  readonly id?: number;
  readonly from?: Instant;
  readonly to?: Instant;
  readonly countBy?: string;
  readonly local: boolean;
}

type Checked<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: SimError };

function readFilter(options: Readonly<Record<string, string | true>>): Checked<Filter> {
  const value = (key: string) => {
    const found = options[key];
    return typeof found === "string" ? found : undefined;
  };
  const bad = (
    argument: string,
    typed: string,
    reason: "bad-format" | "unknown-value" | "out-of-range",
  ) => ({ ok: false, error: { code: "BAD_ARGUMENT", argument, value: typed, reason } }) as const;

  const sourceText = value("source");
  const source = sourceText?.toLowerCase();
  if (source !== undefined && !isLogSource(source))
    return bad("--source", sourceText ?? "", "unknown-value");

  const idText = value("id");
  if (idText !== undefined && !/^\d{1,6}$/.test(idText)) return bad("--id", idText, "bad-format");

  const fromText = value("from");
  const from = fromText === undefined ? undefined : parseTime(fromText, false);
  if (fromText !== undefined && from === undefined) return bad("--from", fromText, "bad-format");
  const toText = value("to");
  const to = toText === undefined ? undefined : parseTime(toText, true);
  if (toText !== undefined && to === undefined) return bad("--to", toText, "bad-format");
  if (from !== undefined && to !== undefined && from > to)
    return bad("--to", toText ?? "", "out-of-range");

  const zone = value("zone")?.toLowerCase();
  if (zone !== undefined && zone !== "utc" && zone !== "local") {
    return bad("--zone", value("zone") ?? "", "unknown-value");
  }
  const countBy = value("countBy");
  if (countBy !== undefined && !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(countBy)) {
    return bad("--count-by", countBy, "bad-format");
  }

  return {
    ok: true,
    value: {
      ...(source === undefined ? {} : { source: source as LogSource }),
      ...(idText === undefined ? {} : { id: Number(idText) }),
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
      ...(countBy === undefined ? {} : { countBy }),
      local: zone === "local",
    },
  };
}

/**
 * Takes every `--where` out of the arguments before the rest are parsed, because the option
 * parser keeps only the last value of an option and `--where` is meant to be given more than once.
 */
function takeWhere(args: readonly string[]): {
  conditions: Checked<Condition[]>;
  rest: string[];
} {
  const rest: string[] = [];
  const conditions: Condition[] = [];
  let problem: SimError | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === "--") {
      rest.push(...args.slice(i));
      break;
    }
    let typed: string | undefined;
    if (arg === "--where") {
      typed = args[i + 1];
      if (typed === undefined || typed.startsWith("-")) {
        problem ??= { code: "MISSING_ARGUMENT", argument: "--where" };
        continue;
      }
      i++;
    } else if (arg.startsWith("--where=")) {
      typed = arg.slice("--where=".length);
    } else {
      rest.push(arg);
      continue;
    }
    const cut = typed.indexOf("=");
    const field = typed.slice(0, cut).trim();
    if (cut < 1 || field === "") {
      problem ??= { code: "BAD_ARGUMENT", argument: "--where", value: typed, reason: "bad-format" };
      continue;
    }
    conditions.push({ field, value: typed.slice(cut + 1), typed });
  }
  return {
    conditions: problem ? { ok: false, error: problem } : { ok: true, value: conditions },
    rest,
  };
}

/** A record's value for a field name: one of its fields (any capitals), or source, host or id. */
export function fieldValue(record: LogRecord, field: string): string | undefined {
  const lower = field.toLowerCase();
  const key = Object.keys(record.fields).find((name) => name.toLowerCase() === lower);
  if (key !== undefined) return record.fields[key];
  // Names that match a record's own properties, when no field has that name.
  switch (lower) {
    case "source":
      return record.source;
    case "host":
      return record.host;
    case "id":
      return record.eventId === undefined ? undefined : String(record.eventId);
    default:
      return undefined;
  }
}

const matches = (record: LogRecord, condition: Condition): boolean =>
  fieldValue(record, condition.field)?.toLowerCase() === condition.value.toLowerCase();

/**
 * "2026-04-11", "2026-04-11T19:40", "2026-04-11 19:40:00Z" or "2026-04-11T20:40+01:00". No Z and
 * no offset means UTC. A date on its own is the start of that day, or its end for `--to`.
 */
export function parseTime(text: string, endOfDay: boolean): Instant | undefined {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?$/i.exec(
      text.trim(),
    );
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s, zone] = match;
  const parts = [y, mo, d, h ?? "0", mi ?? "0", s ?? "0"].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const [year, month, day, hour, minute, second] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return undefined;
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
  if (day > days) return undefined; // 31 April and the like
  let at = Date.UTC(year, month - 1, day, hour, minute, second);
  if (zone && zone.toUpperCase() !== "Z") {
    const sign = zone.startsWith("-") ? -1 : 1;
    const digits = zone.slice(1).replace(":", "");
    at -= sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) * 60_000;
  }
  if (h === undefined && endOfDay) at += 86_400_000 - 1;
  return at;
}

/** Each record in its source's shape, a ref on every line, and a gap after a multi-line one. */
function recordLines(records: readonly LogRecord[], zones?: EvidenceSet): OutputLine[] {
  const lines: OutputLine[] = [];
  for (const record of records) {
    const ref = formatRef({ kind: "log", source: record.source, seq: record.seq });
    const zone = zones?.zones[record.source] ?? UTC_ZONE;
    const rendered = renderLog(record, { zone });
    for (const text of rendered) lines.push({ stream: "stdout", text, ref });
    if (rendered.length > 1) lines.push(stdout(""));
  }
  const last = lines[lines.length - 1];
  if (last && last.text !== "") lines.push(stdout(""));
  return lines;
}

/** The --count-by table: each value, how many, and the first and last time it appears. */
function countTable(
  records: readonly LogRecord[],
  field: string,
  again: string,
  zones?: EvidenceSet,
): OutputLine[] {
  const groups = new Map<string, LogRecord[]>();
  for (const record of records) {
    const value = fieldValue(record, field) ?? "(none)";
    groups.set(value, [...(groups.get(value) ?? []), record]);
  }
  const rows = [...groups.entries()].sort(
    ([a, x], [b, y]) => y.length - x.length || (a < b ? -1 : a > b ? 1 : 0),
  );
  const show = (record: LogRecord) =>
    formatInstant(record.at, { zone: zones?.zones[record.source] ?? UTC_ZONE });
  const width = String(rows[0]?.[1].length ?? 0).length;
  const table = columns([
    [field, "Records", "First", "Last"],
    ...rows.map(([value, group]) => [
      value,
      String(group.length).padStart(Math.max(width, 7)),
      show(group[0] as LogRecord),
      show(group[group.length - 1] as LogRecord),
    ]),
  ]).map((text) => stdout(`  ${text}`));

  const [top] = rows;
  const lines = [...table, stdout("")];
  lines.push(
    stdout(`${plural(rows.length, "different value")} across ${plural(records.length, "record")}.`),
  );
  if (rows.every(([value]) => value === "(none)")) {
    lines.push(
      stdout(`None of these records has a field called ${field}. Field names are the ones`),
    );
    lines.push(stdout("printed in the records themselves, such as TargetUserName or IpAddress."));
  } else if (top && top[1].length >= 10 && top[1].length * 2 > records.length) {
    lines.push(
      stdout(`Most of them share one value. To read them: ${again} --where ${field}=${top[0]}`),
    );
  }
  return lines;
}
