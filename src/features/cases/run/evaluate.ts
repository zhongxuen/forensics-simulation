import type { SimEvent } from "@/sim/types";
import type { CaseObjective, ObjectiveCheck, RunnableCase } from "./case-definition";
import { gradeQuestion } from "./report";

/**
 * The objective evaluator (docs/plan/05-workspace-ui.md §Case runner). It matches Hacker
 * Simulation's `evaluateObjectives` for the mission kinds (`event` and `commandRun`), and headless
 * play's `holds` (loader/play.ts) for the forensics ones: a ref pinned to the board, a report answer
 * that's supported, and `all` / `any` groups. The two are held to agree by
 * `tests/content/case-browser-play.test.ts`, which plays each case's playthrough through this.
 *
 * Pure: the case, every event since the run started, and the board and report as they stand in;
 * the objectives that hold out.
 */
export type ObjectiveEvaluator = (
  caseDef: Pick<RunnableCase, "objectives" | "report">,
  events: readonly SimEvent[],
  board?: RunBoard,
) => string[];

/** What the player has put down: pins on the board and the report draft. */
export interface RunBoard {
  readonly pins: readonly string[];
  readonly reportDraft: Readonly<Record<string, string>>;
}

const EMPTY_BOARD: RunBoard = { pins: [], reportDraft: {} };

/** Ids of the objectives whose checks hold, in the case's objective order. */
export const evaluateObjectives: ObjectiveEvaluator = (caseDef, events, board = EMPTY_BOARD) =>
  caseDef.objectives
    .filter((objective) => holds(objective.check, caseDef, events, board))
    .map((objective) => objective.id);

function holds(
  check: ObjectiveCheck,
  caseDef: Pick<RunnableCase, "report">,
  events: readonly SimEvent[],
  board: RunBoard,
): boolean {
  switch (check.kind) {
    case "all":
      return check.of.every((inner) => holds(inner, caseDef, events, board));
    case "any":
      return check.of.some((inner) => holds(inner, caseDef, events, board));
    case "pinned":
      return check.refs.some((ref) => board.pins.includes(ref));
    case "reported": {
      const question = caseDef.report?.questions.find((item) => item.id === check.question);
      return (
        question !== undefined &&
        gradeQuestion(question, board.reportDraft[question.id], board.pins).verdict === "supported"
      );
    }
    case "event":
      return events.some((event) => event.type === check.event && eventMatches(event, check.match));
    case "commandRun": {
      const pattern = compiled(check.pattern);
      return events.some(
        (event) =>
          event.type === "command.run" &&
          (check.anyExitCode === true || event.exitCode === 0) &&
          pattern.test(event.line),
      );
    }
  }
}

/** Every `match` field equals the event's field of the same name (strict equality). */
export function eventMatches(
  event: SimEvent,
  match: Readonly<Record<string, string | number | boolean>> | undefined,
): boolean {
  if (!match) return true;
  const fields: ReadonlyMap<string, unknown> = new Map(Object.entries(event));
  return Object.entries(match).every(
    ([key, value]) => fields.has(key) && fields.get(key) === value,
  );
}

/** Compiled once per pattern. Patterns have no flags, so `test` keeps no state between calls. */
const patterns = new Map<string, RegExp>();

function compiled(pattern: string): RegExp {
  let regex = patterns.get(pattern);
  if (!regex) {
    regex = new RegExp(pattern);
    patterns.set(pattern, regex);
  }
  return regex;
}

/** The main objectives: not bonuses, not secrets. */
export const mainObjectives = (caseDef: Pick<RunnableCase, "objectives">): CaseObjective[] =>
  caseDef.objectives.filter((objective) => !objective.optional && !objective.hidden);

/** Every main objective is ticked. */
export function isCaseComplete(
  caseDef: Pick<RunnableCase, "objectives">,
  completed: readonly string[],
): boolean {
  return mainObjectives(caseDef).every((objective) => completed.includes(objective.id));
}

/** Main objectives done, of how many: "2 of 3". */
export function caseProgress(
  caseDef: Pick<RunnableCase, "objectives">,
  completed: readonly string[],
): { done: number; total: number } {
  const main = mainObjectives(caseDef);
  return {
    done: main.filter((objective) => completed.includes(objective.id)).length,
    total: main.length,
  };
}
