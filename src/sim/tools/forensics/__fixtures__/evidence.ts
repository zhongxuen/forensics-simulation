/**
 * The evidence the disk tools' tests run against, and the workstation they run on.
 *
 * Built with `build` (src/sim/evidence/builder.ts), never by hand, so these fixtures stay the same
 * shape as the generator's output (docs/plan/02-evidence-model.md §The test builder). The names
 * come from docs/plan/99-reference.md: Quillfen Freight's bookkeeper's laptop `qf-lt-07`, and
 * Candlewright's analyst workstation `ir-ws-01` with the account `examiner`.
 *
 * The drive is small on purpose, and shaped to cover every branch the tools have:
 *
 * - a live document, and a live log file in the Windows folder;
 * - a deleted invoice whose clusters nothing has touched, so `recover` can write it out;
 * - a deleted note whose clusters the log file has since taken, so `recover` refuses.
 */
import { fixedClock } from "../../../core/clock";
import { createInitialState } from "../../../core/scenario";
import { step } from "../../../core/step";
import type { SimResult, SimState } from "../../../core/types";
import * as build from "../../../evidence/builder";
import { attachEvidence, setBlocker } from "../../../evidence/session";
import type { EvidenceSet } from "../../../evidence/types";
import type { ScenarioSpec } from "../../../core/types";

/** The examiner's clock while the tests run: the morning after the break-in. */
export const CASE_NOW = Date.UTC(2026, 3, 12, 9, 30, 0);

/** Where the tests write working copies and recovered files. */
export const CASE_DIR = "/home/examiner/cases/case-01";
export const IMAGE_PATH = `${CASE_DIR}/images/qf-lt-07.img`;
export const DEVICE_PATH = "/dev/evidence/qf-lt-07";

export const CASE_SEED = 4104;

/** The analyst workstation, as the engine sees it (docs/plan/99-reference.md §New world facts). */
export const CASE_SCENARIO: ScenarioSpec = {
  id: "disk-tools-fixture",
  startTime: "2026-04-12T09:00:00Z",
  network: {
    subnets: [{ cidr: "10.20.0.0/24", name: "Candlewright blue-team room" }],
    hosts: [
      {
        id: "ir-ws-01",
        hostname: "ir-ws-01.candlewright.example",
        interfaces: [{ ip: "10.20.0.11", subnet: "10.20.0.0/24" }],
        os: { family: "linux", name: "Linux", version: "6.8" },
        services: [],
        users: [{ name: "examiner", uid: 1000, groups: ["adm"] }],
        fs: {
          entries: [
            { path: `${CASE_DIR}/images`, type: "dir" },
            { path: `${CASE_DIR}/export`, type: "dir" },
            {
              path: `${CASE_DIR}/handover.txt`,
              content: "Signed by Theo Ashgrove. One laptop drive, qf-lt-07.\n",
            },
          ],
        },
      },
    ],
  },
  session: { host: "ir-ws-01", user: "examiner", cwd: "/home/examiner" },
};

/**
 * Record numbers the tests name. They are set here rather than left to the builder, which numbers
 * folders from 5 as it creates them, so the files keep the same numbers whatever is added above.
 */
export const RECORDS = {
  /** A live document. */
  invoice0412: 42,
  /** Deleted, clusters untouched: recoverable. */
  invoice0413: 51,
  /** Deleted, clusters taken by the log file: not recoverable. */
  note: 55,
  /** Live, and sitting on the note's old clusters. */
  syncLog: 60,
} as const;

/**
 * One disk image and the handover form that came with it. `handover: true` puts the image's real
 * MD5 and SHA-256 on the form, the way the client's copy of the form would carry them.
 */
export function caseEvidence(): EvidenceSet {
  const disk = build
    .disk("qf-lt-07", { model: "Fenwold M2 solid-state drive", serial: "FW-2291-0067" })
    .file("C:\\Users\\dana\\Documents\\inv-0412.pdf", {
      record: RECORDS.invoice0412,
      clusters: [1000, 1001],
      content: "%PDF-1.4 Quillfen Freight invoice 0412: pallet wrap, 3 rolls.",
      at: "2026-04-02T09:14:00Z",
      times: { a: "2026-04-11T18:02:11Z" },
    })
    .file("C:\\Users\\dana\\Documents\\inv-0413.pdf", {
      record: RECORDS.invoice0413,
      clusters: [1002, 1003],
      content: "%PDF-1.4 Quillfen Freight invoice 0413: overnight haulage, Thursday run.",
      at: "2026-04-10T16:41:00Z",
      times: { m: "2026-04-11T19:41:02Z", c: "2026-04-11T19:42:03Z" },
    })
    .file("C:\\Users\\dana\\Documents\\handover-note.txt", {
      record: RECORDS.note,
      clusters: [1004],
      content: "left the yard at six, back Monday",
      at: "2026-04-11T17:20:00Z",
    })
    .file("C:\\Windows\\Temp\\sync.log", {
      record: RECORDS.syncLog,
      clusters: [1004, 1005],
      content: "19:44:10 sync started\n19:44:12 sync finished\n",
      at: "2026-04-11T19:44:12Z",
    })
    .deleted("C:\\Users\\dana\\Documents\\inv-0413.pdf")
    .deleted("C:\\Users\\dana\\Documents\\handover-note.txt")
    .unallocated("%PDF-1.4 Quillfen Freight invoice 0413: overnight haulage, Thursday run.");

  return build
    .evidence("case-01", { seed: CASE_SEED, host: "qf-lt-07" })
    .disk(disk)
    .zone("disk", "Europe/London")
    .handover("qf-lt-07", {
      hashes: true,
      receivedAt: "2026-04-12T08:05:00Z",
      by: "Quillfen Freight office",
    })
    .build();
}

/** The workstation with that evidence attached, every write-blocker on. */
export function caseState(options: { blocker?: boolean } = {}): SimState {
  const state = attachEvidence(createInitialState(CASE_SCENARIO, CASE_SEED), caseEvidence(), {
    now: Date.UTC(2026, 3, 12, 8, 5, 0),
  });
  return options.blocker === false ? setBlocker(state, "qf-lt-07", false) : state;
}

/** The same workstation with no evidence attached, for the "nothing is loaded yet" errors. */
export const bareState = (): SimState => createInitialState(CASE_SCENARIO, CASE_SEED);

/** The SHA-256 on the handover form: the drive as the client handed it over. */
export const formSha256 = (): string => caseEvidence().handover[0]?.hashes?.sha256 ?? "";

/** Runs one command against `state` on the examiner's fixed clock. */
export const runCase = (state: SimState, ...argv: string[]): SimResult =>
  step(state, { type: "exec", argv }, fixedClock(CASE_NOW));

/** The output as plain text, one line per output line. */
export const text = (result: SimResult): string =>
  result.output.map((line) => line.text).join("\n");

/** The typed error codes reported in the output. */
export const errorCodes = (result: SimResult): string[] =>
  result.output.flatMap((line) => (line.error ? [line.error.code] : []));

/** Every artefact ref the output carries, in order. */
export const refs = (result: SimResult): string[] =>
  result.output.flatMap((line) => (line.ref ? [line.ref] : []));

export const eventTypes = (result: SimResult): string[] => result.events.map((event) => event.type);

/** Runs a list of commands in order, keeping the state between them. */
export function runAll(
  state: SimState,
  commands: readonly (readonly string[])[],
): { state: SimState; results: SimResult[] } {
  let current = state;
  const results: SimResult[] = [];
  for (const argv of commands) {
    const result = runCase(current, ...argv);
    results.push(result);
    current = result.state;
  }
  return { state: current, results };
}
