import { describe, expect, it } from "vitest";
import { isReleased } from "@/content/cases/chapter";
import {
  CASE_LISTINGS,
  caseRunReducer,
  createCaseRun,
  custodyLog,
  gradeReport,
  isCaseComplete,
  replayLog,
  reportAnswers,
  toSave,
  type CaseRunAction,
  type CaseRunState,
  type CustodyEntry,
  type RunnableCase,
} from "@/features/cases";
import { loadPlaythrough, playCase, toRunnableCase, type BuiltCase } from "@/features/cases/server";
import { createTerminalSession, resetMachine, submitLine } from "@/features/terminal";
import { attachEvidence, resolveAcceptedEvidence, scenarioStartMs } from "@/sim";
import type { EvidenceSet, SimEvent } from "@/sim/types";
import { builtCases, committedEvidence } from "./support";

/**
 * A case that `pnpm case:play` can finish has to be finishable **in the browser** too. Headless
 * play (loader/play.ts) and the browser's case runner (run/case-run.ts with run/evaluate.ts) are
 * two implementations of the same rules, so this plays the playthrough of each case with a
 * playable page (released or not yet: a case is proved playable before it is offered) through
 * the browser's side — `toRunnableCase`, the evidence JSON the browser loads, the terminal session
 * and `caseRunReducer` — and holds it to what headless play says: the same objectives ticked, and
 * every report answer supported.
 */
const playablePages = new Set(
  CASE_LISTINGS.filter((listing) => listing.status === "playable").map((listing) => listing.slug),
);
const playable = builtCases.filter(
  (built) => isReleased(built.case.id) || playablePages.has(built.case.id),
);

describe("playable cases", () => {
  it("include the chapter's first case", () => {
    expect(playable.map((built) => built.case.id)).toContain("case-01");
  });
});

describe.each(playable.map((built) => [built.case.id, built] as const))("%s", (id, built) => {
  const caseDef = toRunnableCase(built);
  const evidence = committedEvidence(id);
  const playthrough = loadPlaythrough(id, built.case.playthrough);

  it("maps onto the runner with every objective, hint and question", () => {
    expect(caseDef.objectives.map((objective) => objective.id)).toEqual(
      built.case.objectives.map((objective) => objective.id),
    );
    for (const objective of caseDef.objectives) {
      if (!objective.hidden) expect(objective.hints, objective.id).toHaveLength(3);
    }
    expect(caseDef.briefing.opening.length).toBeGreaterThan(0);
    expect(caseDef.briefing.opening.length).toBeLessThanOrEqual(2);
    expect(caseDef.report?.questions.map((question) => question.id)).toEqual(
      built.case.report.questions.map((question) => question.id),
    );
    for (const question of caseDef.report?.questions ?? []) {
      expect(question.acceptedRefs.length, question.id).toBeGreaterThan(0);
    }
  });

  it("starts the workstation at the same instant headless play does", () => {
    expect(scenarioStartMs(caseDef.scenario)).toBe(
      Math.max(...built.evidence.handover.map((item) => item.receivedAt)),
    );
  });

  it("plays its playthrough in the browser exactly as headless play does", () => {
    expect(evidence, `${id} has no built evidence`).toBeDefined();
    expect(playthrough, `${id} has no playthrough`).toBeDefined();
    if (!evidence || !playthrough) return;

    const headless = playCase(built, playthrough.steps);
    const run = playInBrowser(caseDef, evidence, built, playthrough.steps);

    expect([...run.completed].sort()).toEqual([...headless.completed].sort());
    expect(isCaseComplete(caseDef, run.completed)).toBe(true);
    expect(run.pins).toEqual(headless.pins);
    const grades = gradeReport(
      caseDef.report ?? { questions: [] },
      reportAnswers(run.reportDraft, run.citations),
      run.pins,
    );
    expect(grades.map((grade) => grade.verdict)).toEqual(
      headless.report.map((grade) => grade.verdict),
    );
    expect(grades.every((grade) => grade.verdict === "supported")).toBe(true);
  });

  it("keeps a chain of custody that matches the event stream exactly", () => {
    if (!evidence || !playthrough) return;
    const run = playInBrowser(caseDef, evidence, built, playthrough.steps);
    const log = custodyLog(run.events, run.marks);

    // An oracle written separately from the selector: one entry per evidence event and terminal
    // pin, in the order the engine emitted them, with a blocked read folded into its own hash or
    // image; then one per view pin, and the report submission last.
    const expected = run.events.flatMap((event) => oracle(event));
    const viewPins = run.marks.filter((mark) => mark.kind === "pinned").length;
    expect(log.filter((entry) => entry.kind !== "examined").map((entry) => entry.kind)).toEqual(
      withMarks(expected, viewPins),
    );
    expect(log.map((entry) => entry.n)).toEqual(log.map((_, index) => index + 1));
    expect(log.at(-1)?.kind).toBe("submitted");
  });

  it("rebuilds the same chain of custody from a save", () => {
    if (!evidence || !playthrough) return;
    const run = playInBrowser(caseDef, evidence, built, playthrough.steps);
    const save = toSave(run, 0);
    expect(save).toBeDefined();
    if (!save) return;

    const now = scenarioStartMs(caseDef.scenario);
    const fresh = createTerminalSession({
      scenario: caseDef.scenario,
      seed: caseDef.seed,
      setup: (sim) => attachEvidence(sim, evidence, { now }),
    });
    let restored = caseRunReducer(caseDef, createCaseRun(), {
      type: "restore",
      save,
      sim: fresh.sim,
    });
    replayLog(
      caseDef,
      save.log,
      (session, entry) => {
        restored = caseRunReducer(
          caseDef,
          restored,
          "reset" in entry
            ? { type: "reset", sim: session.sim }
            : { type: "command", events: session.lastEvents, sim: session.sim, replay: true },
        );
      },
      evidence,
    );
    expect(custodyLog(restored.events, restored.marks)).toEqual(custodyLog(run.events, run.marks));
  });
});

describe("case-01's chain of custody", () => {
  const built = playable.find((item) => item.case.id === "case-01");
  const evidence = committedEvidence("case-01");
  const playthrough = built && loadPlaythrough("case-01", built.case.playthrough);

  it("reads, in order, as the playthrough played it, and earns Fingerprint First", () => {
    if (!built || !evidence || !playthrough) throw new Error("case-01 isn't built");
    const caseDef = toRunnableCase(built);
    const run = playInBrowser(caseDef, evidence, built, playthrough.steps);
    const summary = custodyLog(run.events, run.marks).map(summarise);
    expect(summary).toEqual([
      "hashed /dev/evidence/qf-lt-03 match",
      "original-read /dev/evidence/qf-lt-03 lsfs blocker-off",
      "original-read /dev/evidence/qf-lt-03 hashsum blocker-off",
      "hashed /dev/evidence/qf-lt-03 mismatch",
      "hashed /dev/evidence/qf-lt-03 match",
      "acquired /dev/evidence/qf-lt-03",
      expect.stringMatching(/^hashed .*images\/qf-lt-03\.img match$/),
      expect.stringMatching(/^hashed .*images\/qf-lt-03\.img match$/),
      "examined lsfs",
      "examined inode",
      "pinned disk:qf-lt-03:mft/46 terminal",
      "recovered disk:qf-lt-03:mft/46",
      "submitted 3 of 3",
    ]);
    expect(run.completed).toContain("hash-before-opening");
  });
});

function summarise(entry: CustodyEntry): string {
  switch (entry.kind) {
    case "hashed":
      return `hashed ${entry.target} ${entry.verified === false ? "mismatch" : "match"}`;
    case "original-read":
      return `original-read ${entry.device} ${entry.tool} ${entry.blocker ? "blocked" : "blocker-off"}`;
    case "acquired":
      return `acquired ${entry.device}`;
    case "examined":
      return `examined ${entry.tool}`;
    case "pinned":
      return `pinned ${entry.ref} ${entry.from}`;
    case "recovered":
      return `recovered ${entry.ref}`;
    case "submitted":
      return `submitted ${entry.supported} of ${entry.total}`;
    case "carved":
      return "carved";
  }
}

function oracle(event: SimEvent): CustodyEntry["kind"][] {
  switch (event.type) {
    case "evidence.acquired":
      return ["acquired"];
    case "evidence.hashed":
      return ["hashed"];
    case "evidence.recovered":
      return ["recovered"];
    case "evidence.carved":
      return ["carved"];
    case "board.pinned":
      return ["pinned"];
    case "evidence.readOriginal":
      return event.blocker && (event.tool === "acquire" || event.tool === "hashsum")
        ? []
        : ["original-read"];
    default:
      return [];
  }
}

/** The oracle's entries, then the view pins and the submission, which come last in a playthrough. */
function withMarks(kinds: CustodyEntry["kind"][], viewPins: number): CustodyEntry["kind"][] {
  return [...kinds, ...Array.from({ length: viewPins }, () => "pinned" as const), "submitted"];
}

type Step = NonNullable<ReturnType<typeof loadPlaythrough>>["steps"][number];

/** The playthrough's steps as a player would take them in the case runner. */
function playInBrowser(
  caseDef: RunnableCase,
  evidence: EvidenceSet,
  built: BuiltCase,
  steps: readonly Step[],
): CaseRunState {
  const now = scenarioStartMs(caseDef.scenario);
  let session = createTerminalSession({
    scenario: caseDef.scenario,
    seed: caseDef.seed,
    setup: (sim) => attachEvidence(sim, evidence, { now }),
  });
  let run = createCaseRun();
  const dispatch = (action: CaseRunAction) => {
    run = caseRunReducer(caseDef, run, action);
  };

  dispatch({ type: "start", sim: session.sim });
  dispatch({ type: "report" }); // Ignored until every main objective is ticked.
  expect(run.phase).toBe("workspace");

  for (const step of steps) {
    if ("run" in step) {
      dispatch({ type: "log", entry: { line: step.run } });
      session = submitLine(session, step.run);
      dispatch({ type: "command", events: session.lastEvents, sim: session.sim });
    } else if ("reset" in step) {
      dispatch({ type: "log", entry: { reset: true } });
      session = resetMachine(session);
      dispatch({ type: "reset", sim: session.sim });
    } else if ("pin" in step) {
      for (const ref of resolveAcceptedEvidence(built.evidence, step.pin)) {
        dispatch({ type: "pin", ref });
      }
    } else if ("report" in step) {
      if (run.phase === "workspace") dispatch({ type: "report" });
      dispatch({ type: "draft", questionId: step.report, text: step.answer });
      const refs = (step.cite ?? []).flatMap((pattern) =>
        resolveAcceptedEvidence(built.evidence, pattern),
      );
      dispatch({ type: "cite", questionId: step.report, refs });
    } else {
      throw new Error(`the browser runner can't play an answer step yet (${step.objective}).`);
    }
  }
  // Submit report, as the player does at the end; it's the custody record's last entry.
  if (run.phase === "report") dispatch({ type: "submitReport" });
  return run;
}
