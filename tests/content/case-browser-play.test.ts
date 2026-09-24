import { describe, expect, it } from "vitest";
import { isReleased } from "@/content/cases/chapter";
import {
  caseRunReducer,
  createCaseRun,
  gradeReport,
  isCaseComplete,
  type CaseRunAction,
  type CaseRunState,
  type RunnableCase,
} from "@/features/cases";
import { loadPlaythrough, playCase, toRunnableCase, type BuiltCase } from "@/features/cases/server";
import { createTerminalSession, resetMachine, submitLine } from "@/features/terminal";
import { attachEvidence, resolveAcceptedEvidence, scenarioStartMs } from "@/sim";
import type { EvidenceSet } from "@/sim/types";
import { builtCases, committedEvidence } from "./support";

/**
 * A case that `pnpm case:play` can finish has to be finishable **in the browser** too. Headless
 * play (loader/play.ts) and the browser's case runner (run/case-run.ts with run/evaluate.ts) are
 * two implementations of the same rules, so this plays each released case's playthrough through
 * the browser's side — `toRunnableCase`, the evidence JSON the browser loads, the terminal session
 * and `caseRunReducer` — and holds it to what headless play says: the same objectives ticked, and
 * every report answer supported.
 */
const released = builtCases.filter((built) => isReleased(built.case.id));

describe("released cases", () => {
  it("include the chapter's first case", () => {
    expect(released.map((built) => built.case.id)).toContain("case-01");
  });
});

describe.each(released.map((built) => [built.case.id, built] as const))("%s", (id, built) => {
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
    const grades = gradeReport(caseDef.report ?? { questions: [] }, run.reportDraft, run.pins);
    expect(grades.map((grade) => grade.verdict)).toEqual(
      headless.report.map((grade) => grade.verdict),
    );
    expect(grades.every((grade) => grade.verdict === "supported")).toBe(true);
  });
});

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
      session = submitLine(session, step.run);
      dispatch({ type: "command", events: session.lastEvents, sim: session.sim });
    } else if ("reset" in step) {
      session = resetMachine(session);
      dispatch({ type: "reset", sim: session.sim });
    } else if ("pin" in step) {
      for (const ref of resolveAcceptedEvidence(built.evidence, step.pin)) {
        dispatch({ type: "pin", ref });
      }
    } else if ("report" in step) {
      if (run.phase === "workspace") dispatch({ type: "report" });
      dispatch({ type: "draft", questionId: step.report, text: step.answer });
    } else {
      throw new Error(`the browser runner can't play an answer step yet (${step.objective}).`);
    }
  }
  return run;
}
