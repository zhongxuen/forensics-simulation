import type { SimEvent } from "@/sim/types";
import type { CaseObjective, ObjectiveCheck, RunnableCase } from "./case-definition";

/**
 * The stub objective evaluator (docs/plan/05-workspace-ui.md §Case runner): enough to tick the
 * practice case's objectives from engine events, until file 03's evaluator takes over. It matches
 * Hacker Simulation's `evaluateObjectives` for the two kinds it knows (`event` and `commandRun`),
 * so swapping it is a change of import, not of behaviour.
 *
 * Pure: the case and every event since the run started in, the objectives that hold out.
 */
export type ObjectiveEvaluator = (
  caseDef: Pick<RunnableCase, "objectives">,
  events: readonly SimEvent[],
) => string[];

/** Ids of the objectives whose checks hold, in the case's objective order. */
export const evaluateObjectives: ObjectiveEvaluator = (caseDef, events) =>
  caseDef.objectives
    .filter((objective) => holds(objective.check, events))
    .map((objective) => objective.id);

function holds(check: ObjectiveCheck, events: readonly SimEvent[]): boolean {
  switch (check.kind) {
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
