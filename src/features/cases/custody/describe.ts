import type { HandoverItem } from "@/sim/types";
import { BROWSER_TOOL, type CustodyEntry, type CustodyKind } from "./custody-log";

/**
 * The words for each custody entry, shared by the Objectives sub-tab, the debrief and the
 * plain-text export, so all three always say the same thing. Pure: no clock, no locale.
 */

/** Each kind's short label, sentence case. */
export const CUSTODY_LABELS: Readonly<Record<CustodyKind, string>> = {
  acquired: "Acquired",
  hashed: "Hashed",
  "original-read": "Original read",
  recovered: "Recovered",
  carved: "Carved",
  examined: "Examined",
  pinned: "Pinned",
  submitted: "Report submitted",
};

const toolName = (tool: string) => (tool === BROWSER_TOOL ? "the Evidence Browser" : tool);

const ALGORITHMS: Readonly<Record<string, string>> = {
  md5: "MD5",
  sha1: "SHA-1",
  "sha-1": "SHA-1",
  sha256: "SHA-256",
  "sha-256": "SHA-256",
};

const algorithmName = (algorithm: string) =>
  ALGORITHMS[algorithm.toLowerCase()] ?? algorithm.toUpperCase();

/** One sentence (or two) saying what happened. Paths, refs and digests appear as written. */
export function describeCustody(entry: CustodyEntry): string {
  switch (entry.kind) {
    case "acquired":
      return `Imaged ${entry.device} to ${entry.image}. SHA-256 ${entry.sha256}, MD5 ${entry.md5}.`;
    case "hashed": {
      const what = `Hashed ${entry.target} with ${algorithmName(entry.algorithm)}: ${entry.digest}.`;
      if (entry.verified === true) return `${what} MATCH: it is the hash that was expected.`;
      if (entry.verified === false)
        return `${what} MISMATCH: it is not the hash that was expected.`;
      return what;
    }
    case "original-read":
      return entry.blocker
        ? `Read the original ${entry.device} with ${toolName(entry.tool)}, through its write-blocker. Nothing on it changed.`
        : `Read the original ${entry.device} with ${toolName(entry.tool)} while its write-blocker was off. Its access times changed, and its hash with them.`;
    case "recovered":
      return `Recovered record ${entry.record} from ${entry.image} to ${entry.path}.`;
    case "carved":
      return `Carved ${entry.ref ?? "an object"}${entry.image ? ` from ${entry.image}` : ""}${entry.path ? ` to ${entry.path}` : ""}.`;
    case "examined":
      return `Examined the evidence with ${entry.tool}: ${entry.line}`;
    case "pinned":
      return `Pinned ${entry.ref} to the case board${entry.from === "view" ? " from a view" : ""}.${entry.note ? ` Note: ${entry.note}` : ""}`;
    case "submitted":
      return entry.total === 0
        ? "Submitted the report."
        : `Submitted the report: ${entry.supported} of ${entry.total} ${entry.total === 1 ? "finding" : "findings"} supported.`;
  }
}

/** What goes at the top of an exported record. */
export interface CustodyRecordHeader {
  readonly caseTitle: string;
  readonly caseId: string;
  readonly client: string;
  /** Who signed the letter. */
  readonly signedBy: string;
  /** What was handed over, from the case's evidence. */
  readonly handover: readonly HandoverItem[];
  /** When the record was exported, already formatted, or omitted. Passed in, so this stays pure. */
  readonly exportedAt?: string;
  /** Formats an instant for the handover lines. */
  readonly formatTime: (at: number) => string;
}

const RULE = "=".repeat(72);

/**
 * The plain-text custody record the debrief exports, stamped SIMULATED at the top and the bottom
 * so it can never be mistaken for a real one.
 */
export function custodyText(log: readonly CustodyEntry[], header: CustodyRecordHeader): string {
  const lines: string[] = [
    RULE,
    "SIMULATED CHAIN OF CUSTODY RECORD",
    "Candlewright: Incident Room is a game. Every name, drive and hash below is made up.",
    RULE,
    "",
    `Case:        ${header.caseTitle} (${header.caseId})`,
    `Client:      ${header.client}`,
    `Signed by:   ${header.signedBy}`,
    "Examiner:    examiner, on the workstation ir-ws-01",
    ...(header.exportedAt ? [`Exported:    ${header.exportedAt}`] : []),
    "",
    "Handed over",
    "-----------",
  ];
  if (header.handover.length === 0) lines.push("Nothing was handed over.");
  for (const item of header.handover) {
    lines.push(`${item.item}, by ${item.by}, received ${header.formatTime(item.receivedAt)}`);
    if (item.hashes) {
      lines.push(`  SHA-256 ${item.hashes.sha256}`, `  MD5     ${item.hashes.md5}`);
    }
  }
  lines.push("", "What the examiner did, in order", "-------------------------------");
  if (log.length === 0) lines.push("Nothing yet.");
  const width = String(log.length).length;
  for (const entry of log) {
    lines.push(
      `${String(entry.n).padStart(width)}. ${CUSTODY_LABELS[entry.kind]}: ${describeCustody(entry)}`,
    );
  }
  lines.push("", RULE, "SIMULATED. Not a real custody record.", RULE, "");
  return lines.join("\n");
}
