import type { Playthrough } from "@/content/cases/playthrough";
import { mainObjectiveIds, playCase, type CasePlayResult } from "./play";
import type { BuiltCase } from "./source";

/**
 * Checking a playthrough against what the case says should happen
 * (docs/plan/03-case-format-and-generator.md §Tests, group 5). Pure, so `pnpm case:play`,
 * `pnpm case:validate` and the solvability test all agree.
 *
 * Every problem is a line an author can act on: which step, what was expected, and what happened.
 */

export interface PlaythroughCheck {
  readonly result: CasePlayResult;
  /** Every way the case didn't do what the playthrough says, in words an author can act on. */
  readonly problems: readonly string[];
}

export function verifyPlaythrough(built: BuiltCase, playthrough: Playthrough): PlaythroughCheck {
  const entry = built.case;
  const problems: string[] = [];
  const objectiveIds = new Set(entry.objectives.map((objective) => objective.id));
  const unknown = (where: string, id: string) => {
    if (!objectiveIds.has(id))
      problems.push(`${where}: there's no objective "${id}" in ${entry.id}.`);
  };

  if (playthrough.case !== entry.id) {
    problems.push(`The playthrough is for "${playthrough.case}", not "${entry.id}".`);
  }

  const result = playCase(built, playthrough.steps);

  playthrough.steps.forEach((step, index) => {
    const where = `steps[${index + 1}]${labelOf(step)}`;
    const played = result.steps[index];
    if (!played) return;
    if (played.problem !== undefined) problems.push(`${where}: ${played.problem}`);

    if ("report" in step && played.verdict !== undefined && played.verdict !== step.verdict) {
      const grade = result.report.find((item) => item.questionId === step.report);
      const because =
        played.verdict === "not-yet"
          ? ` The answer key says "${questionAnswer(built, step.report)}".`
          : played.verdict === "needs-evidence"
            ? ` Nothing on the board supports it yet. Pin one of: ${(grade?.acceptedRefs ?? []).join(", ")}.`
            : "";
      problems.push(
        `${where}: the answer came back "${played.verdict}", and the playthrough expects "${step.verdict}".${because}`,
      );
    }

    if ("objective" in step && played.accepted !== undefined && played.accepted !== step.accepted) {
      unknown(where, step.objective);
      problems.push(
        `${where}: the answer "${step.answer}" was ${played.accepted ? "accepted" : "not accepted"}, and the playthrough expects it ${step.accepted ? "accepted" : "not accepted"}.`,
      );
    }

    for (const id of step.ticks ?? []) {
      unknown(where, id);
      if (!played.ticked.includes(id)) {
        problems.push(`${where}: expected it to tick "${id}", and it didn't.`);
      }
    }
  });

  if (playthrough.expect.complete && !result.complete) {
    const missing = mainObjectiveIds(entry).filter((id) => !result.completed.includes(id));
    problems.push(`The case didn't complete. Main objectives still open: ${missing.join(", ")}.`);
  }
  if (!playthrough.expect.complete && result.complete) {
    problems.push("The case completed, and the playthrough expects it not to.");
  }
  for (const id of playthrough.expect.objectives) {
    unknown("expect.objectives", id);
    if (!result.completed.includes(id)) {
      problems.push(`expect.objectives: "${id}" was never ticked.`);
    }
  }
  if (playthrough.expect.supported) {
    for (const grade of result.report) {
      if (grade.verdict === "supported") continue;
      problems.push(
        grade.verdict === "not-yet"
          ? `report.${grade.questionId}: never answered, so the case can't be closed. The answer is "${questionAnswer(built, grade.questionId)}".`
          : `report.${grade.questionId}: answered, but nothing on the board supports it. Pin one of: ${grade.acceptedRefs.join(", ")}.`,
      );
    }
  }

  return { result, problems };
}

const questionAnswer = (built: BuiltCase, id: string): string =>
  built.case.report.questions.find((question) => question.id === id)?.answer ?? "";

function labelOf(step: Playthrough["steps"][number]): string {
  if ("run" in step) return ` (${step.run})`;
  if ("pin" in step) return ` (pin ${step.pin})`;
  if ("report" in step) return ` (report ${step.report})`;
  if ("objective" in step) return ` (answer ${step.objective})`;
  return " (reset)";
}
