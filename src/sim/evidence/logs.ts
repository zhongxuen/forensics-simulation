import { formatInstant, formatOffset, pad2, UTC_ZONE, zonedParts } from "./time";
import type { LogRecord, LogSource } from "./types";

/**
 * Prints log records in each source's native shape (docs/plan/02-evidence-model.md §Logs). The
 * shapes are written from the public format descriptions (Microsoft Learn's security audit event
 * pages, the Sysmon event list, Apache's LogFormat documentation), not copied from any tool's
 * output. Output is line-based so the vendored shell can pipe it through `grep`.
 */

export interface RenderLogOptions {
  /**
   * Show local time in this zone (from `EvidenceSet.zones[source]`) instead of UTC. The record's
   * `at` is always UTC; only the display changes.
   */
  readonly zone?: string;
}

/** What each Windows-style event id means, and the order its fields are listed in. */
export interface EventInfo {
  readonly description: string;
  /** Windows Security events: whether the audit passed. */
  readonly outcome?: "Audit Success" | "Audit Failure";
  readonly fields: readonly string[];
}

/** Windows Security log events (Microsoft Learn, "Windows security audit events"). */
export const SECURITY_EVENTS: Readonly<Record<number, EventInfo>> = {
  4624: {
    description: "An account was successfully logged on.",
    outcome: "Audit Success",
    fields: [
      "SubjectUserName",
      "SubjectDomainName",
      "TargetUserName",
      "TargetDomainName",
      "LogonType",
      "LogonProcessName",
      "AuthenticationPackageName",
      "WorkstationName",
      "IpAddress",
      "IpPort",
      "TargetLogonId",
    ],
  },
  4625: {
    description: "An account failed to log on.",
    outcome: "Audit Failure",
    fields: [
      "TargetUserName",
      "TargetDomainName",
      "LogonType",
      "Status",
      "SubStatus",
      "FailureReason",
      "WorkstationName",
      "IpAddress",
      "IpPort",
    ],
  },
  4634: {
    description: "An account was logged off.",
    outcome: "Audit Success",
    fields: ["TargetUserName", "TargetDomainName", "TargetLogonId", "LogonType"],
  },
  4672: {
    description: "Special privileges assigned to new logon.",
    outcome: "Audit Success",
    fields: ["SubjectUserName", "SubjectDomainName", "SubjectLogonId", "PrivilegeList"],
  },
  4688: {
    description: "A new process has been created.",
    outcome: "Audit Success",
    fields: [
      "SubjectUserName",
      "SubjectDomainName",
      "NewProcessId",
      "NewProcessName",
      "ParentProcessName",
      "CommandLine",
      "TokenElevationType",
    ],
  },
  4720: {
    description: "A user account was created.",
    outcome: "Audit Success",
    fields: [
      "SubjectUserName",
      "SubjectDomainName",
      "TargetUserName",
      "TargetDomainName",
      "SamAccountName",
    ],
  },
  4732: {
    description: "A member was added to a security-enabled local group.",
    outcome: "Audit Success",
    fields: [
      "SubjectUserName",
      "SubjectDomainName",
      "MemberName",
      "MemberSid",
      "TargetUserName",
      "TargetDomainName",
    ],
  },
};

/** The sysmon-lite monitor's events, numbered like Sysmon's public event list. */
export const SYSMON_LITE_EVENTS: Readonly<Record<number, EventInfo>> = {
  1: {
    description: "Process created.",
    fields: ["ProcessId", "Image", "CommandLine", "User", "ParentProcessId", "ParentImage"],
  },
  3: {
    description: "Network connection detected.",
    fields: [
      "ProcessId",
      "Image",
      "User",
      "Protocol",
      "SourceIp",
      "SourcePort",
      "DestinationIp",
      "DestinationPort",
    ],
  },
  11: {
    description: "File created.",
    fields: ["ProcessId", "Image", "TargetFilename"],
  },
  23: {
    description: "File deleted.",
    fields: ["ProcessId", "Image", "User", "TargetFilename"],
  },
};

/** The event ids renderLog knows by name, per source. Others still render, with a generic title. */
export const KNOWN_EVENT_IDS: Readonly<Partial<Record<LogSource, readonly number[]>>> = {
  security: Object.keys(SECURITY_EVENTS).map(Number),
  "sysmon-lite": Object.keys(SYSMON_LITE_EVENTS).map(Number),
};

/** Field orders for the line-shaped sources: listed first in this order, the rest after, sorted. */
const FIREWALL_FIELDS = ["action", "proto", "src", "spt", "dst", "dpt", "bytes", "rule"];
const VPN_FIELDS = ["user", "src", "assigned", "reason"];

/** Renders one record as the lines its source would print. */
export function renderLog(record: LogRecord, options: RenderLogOptions = {}): string[] {
  const zone = options.zone ?? UTC_ZONE;
  switch (record.source) {
    case "security":
      return renderEvent(record, zone, SECURITY_EVENTS);
    case "sysmon-lite":
      return renderEvent(record, zone, SYSMON_LITE_EVENTS);
    case "web-access":
      return [renderWebAccess(record, zone)];
    case "firewall":
      return [
        `${formatInstant(record.at, { zone })} ${record.host} ${keyValues(record.fields, FIREWALL_FIELDS)}`,
      ];
    case "dns":
      return [renderDns(record, zone)];
    case "vpn": {
      const { event = "session", ...rest } = record.fields;
      return [
        `${formatInstant(record.at, { zone })} ${record.host} vpn[${event}] ${keyValues(rest, VPN_FIELDS)}`,
      ];
    }
  }
}

/**
 * An event-log record: a header block, then its fields indented one level.
 *
 *   EventID      4624  An account was successfully logged on.
 *   TimeCreated  2026-04-11T19:40:12Z
 *   Computer     qf-lt-07
 *   Keywords     Audit Success
 *     TargetUserName  dana
 */
function renderEvent(
  record: LogRecord,
  zone: string,
  table: Readonly<Record<number, EventInfo>>,
): string[] {
  const info = record.eventId === undefined ? undefined : table[record.eventId];
  const header: [string, string][] = [
    ["EventID", `${record.eventId ?? "-"}  ${info?.description ?? "Event."}`],
    ["TimeCreated", formatInstant(record.at, { zone })],
    ["Computer", record.host],
  ];
  if (info?.outcome) header.push(["Keywords", info.outcome]);
  const headerWidth = Math.max(...header.map(([k]) => k.length));
  const lines = header.map(([k, v]) => `${k.padEnd(headerWidth)}  ${v}`);

  const names = orderedKeys(record.fields, info?.fields ?? []);
  const width = Math.max(0, ...names.map((n) => n.length));
  for (const name of names) lines.push(`  ${name.padEnd(width)}  ${record.fields[name] ?? ""}`);
  return lines;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Apache's "combined" format:
 *   %h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i"
 * `%t` is `[day/Mon/year:HH:MM:SS +hhmm]`. `%b` is `-` for an empty body.
 */
function renderWebAccess(record: LogRecord, zone: string): string {
  const f = record.fields;
  const p = zonedParts(record.at, zone);
  const time =
    `[${pad2(p.day)}/${MONTHS[p.month - 1]}/${p.year}:` +
    `${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)} ${formatOffset(p.offsetMinutes, "")}]`;
  const request = `${f.method ?? "GET"} ${f.path ?? "/"} ${f.protocol ?? "HTTP/1.1"}`;
  const bytes = !f.bytes || f.bytes === "0" ? "-" : f.bytes;
  return [
    f.clientIp ?? "-",
    f.ident ?? "-",
    f.user ?? "-",
    time,
    `"${request}"`,
    f.status ?? "-",
    bytes,
    `"${f.referer ?? "-"}"`,
    `"${f.userAgent ?? "-"}"`,
  ].join(" ");
}

/** "<time> <host> query <type> <name> from <client> -> <rcode> [<answer>]" */
function renderDns(record: LogRecord, zone: string): string {
  const { client = "-", query = "-", type = "A", rcode = "NOERROR", answer } = record.fields;
  const tail = answer ? ` ${answer}` : "";
  return `${formatInstant(record.at, { zone })} ${record.host} query ${type} ${query} from ${client} -> ${rcode}${tail}`;
}

/** key=value pairs, known keys first. Values with spaces or quotes are quoted. */
function keyValues(fields: Readonly<Record<string, string>>, order: readonly string[]): string {
  return orderedKeys(fields, order)
    .map((key) => `${key}=${quoteValue(fields[key] ?? "")}`)
    .join(" ");
}

function quoteValue(value: string): string {
  return value === "" || /[\s"=]/.test(value) ? `"${value.replace(/["\\]/g, "\\$&")}"` : value;
}

function orderedKeys(fields: Readonly<Record<string, string>>, order: readonly string[]): string[] {
  const present = Object.keys(fields);
  const known = order.filter((k) => present.includes(k));
  const rest = present.filter((k) => !order.includes(k)).sort(compareCodeUnits);
  return [...known, ...rest];
}

/** Sorts by UTF-16 code units, never by locale, so output is the same on every machine. */
function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
