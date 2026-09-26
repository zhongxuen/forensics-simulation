import { WORKSTATION } from "@/content/sandbox/workstation";
import type { Case } from "@/content/cases/schema";
import { formatInstant } from "@/sim";
import type { EvidenceSet, FsEntrySpec, Instant, ScenarioSpec } from "@/sim/types";

/**
 * The analyst workstation a case is examined from (docs/plan/03-case-format-and-generator.md).
 *
 * Every case runs on the same machine — `ir-ws-01`, the vendored sandbox workstation
 * (`src/content/sandbox/workstation.ts`) — with one folder added for the case: the signed letter,
 * the handover form the evidence arrived with, any other paperwork in the case file's `documents`,
 * and the two empty folders the disk tools write into. The evidence itself is never a file here: `attachEvidence` puts each drive under
 * `/dev/evidence` as a device behind a write-blocker (`src/sim/evidence/session.ts`).
 *
 * The clock starts when the evidence was handed over, so the in-world times on the workstation sit
 * after everything in the story, the way they would on the morning the bag arrives.
 */

/** Where a case's own paperwork lives on the workstation. */
export const caseDir = (caseId: string): string => `/home/examiner/cases/${caseId}`;

/** A day after the last thing in the story, for a case whose story hands nothing over. */
const DAY = 86_400_000;

export interface CaseScenario {
  readonly scenario: ScenarioSpec;
  readonly seed: number;
  /** When the examiner sits down: the in-world start time, as an instant. */
  readonly startsAt: Instant;
}

/** The workstation for a case, with its paperwork in `/home/examiner/cases/<id>`. */
export function caseScenario(entry: Case, evidence: EvidenceSet): CaseScenario {
  const dir = caseDir(entry.id);
  const startsAt = examinerStart(entry, evidence);

  const files: FsEntrySpec[] = [
    { path: `${dir}/letter.txt`, content: letterText(entry) },
    { path: `${dir}/handover.txt`, content: handoverText(entry, evidence) },
    ...entry.documents.map((document) => ({
      path: `${dir}/${document.file}`,
      content: `${document.content.trim()}\n`,
    })),
    { path: `${dir}/images`, type: "dir" },
    { path: `${dir}/export`, type: "dir" },
  ];

  return {
    seed: entry.seed,
    startsAt,
    // A fixture's id starts with "_", which a scenario id may not, so it is dropped here.
    scenario: workstationWith(`case-${entry.id.replace(/^_+/, "")}`, startsAt, dir, files),
  };
}

/**
 * The analyst workstation with a folder of paperwork added, its clock at `startsAt` and the
 * terminal opening in `dir`. A case's folder is built this way, and so is the sandbox's.
 */
export function workstationWith(
  id: string,
  startsAt: Instant,
  dir: string,
  files: readonly FsEntrySpec[],
): ScenarioSpec {
  const host = WORKSTATION.scenario.network.hosts[0];
  if (!host) throw new Error("workstationWith: the workstation scenario has no host.");
  return {
    ...WORKSTATION.scenario,
    id,
    startTime: formatInstant(startsAt),
    network: {
      ...WORKSTATION.scenario.network,
      hosts: [
        { ...host, fs: { ...host.fs, entries: [...(host.fs?.entries ?? []), ...files] } },
        ...WORKSTATION.scenario.network.hosts.slice(1),
      ],
    },
    session: { ...WORKSTATION.scenario.session, cwd: dir },
  };
}

/** The handover, if the story has one; otherwise a day after the last thing that happened. */
function examinerStart(entry: Case, evidence: EvidenceSet): Instant {
  const received = evidence.handover.map((item) => item.receivedAt);
  const latest = Math.max(...entry.story.map((action) => action.at));
  return received.length > 0 ? Math.max(...received) : latest + DAY;
}

/** The signed letter, as it sits in the case folder for the player to read first. */
function letterText(entry: Case): string {
  return [
    "Candlewright Security, letter of engagement",
    "",
    `Client:  ${entry.client.org}`,
    `Signed:  ${entry.client.signedBy}`,
    "",
    entry.client.letter.trim(),
    "",
    "In scope:",
    entry.briefing.authorization.trim(),
    "",
  ].join("\n");
}

/**
 * The evidence handover form: what arrived, from whom, when, and the hashes taken at the door.
 * Those hashes are the ones `hashsum --verify` is checked against, so the form and the evidence
 * are built from the same place and can never drift apart.
 */
function handoverText(entry: Case, evidence: EvidenceSet): string {
  return handoverForm(entry.client.org, evidence);
}

/** The handover form for whoever the evidence came from: a client, or Candlewright's own kit. */
export function handoverForm(from: string, evidence: EvidenceSet): string {
  const lines = [`Evidence handover form — ${from}`, ""];
  if (evidence.handover.length === 0) {
    lines.push("Nothing has been handed over yet.", "");
    return lines.join("\n");
  }
  for (const item of evidence.handover) {
    lines.push(
      `Item:      ${item.item}`,
      `Received:  ${formatInstant(item.receivedAt)}`,
      `From:      ${item.by}`,
    );
    if (item.hashes) {
      lines.push(`MD5:       ${item.hashes.md5}`, `SHA-256:   ${item.hashes.sha256}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
