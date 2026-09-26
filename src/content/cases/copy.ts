import type { Case, ObjectiveCheck } from "./schema";

/**
 * Every string a player reads in a case, with where it is written, so tests and
 * `pnpm case:validate` can hold case copy to the voice rules (`findBannedWords`,
 * `src/content/voice.ts`; docs/plan/99-reference.md §Voice).
 *
 * Follows `../hacker-simulation/src/content/mission-copy.ts`. Three things are left out on
 * purpose, because they are not copy:
 *
 * - the **story**, which is ground truth, not prose a player reads;
 * - the client's **letter** and the file contents the story writes, which are realistic documents
 *   — the one place a banned word may legitimately appear;
 * - a report question's `answer` and an `answer` check's `accept` list, which are typed, not read.
 */

export interface CaseCopy {
  /** Where the text lives in the case file: `objectives[find-deletion].why`, `beats[2].text`. */
  readonly path: string;
  readonly text: string;
}

export function caseCopy(entry: Case): CaseCopy[] {
  const copy: CaseCopy[] = [];
  const add = (path: string, text: string) => copy.push({ path, text });

  add("title", entry.title);
  add("hook", entry.hook);
  entry.learningGoals.forEach((goal, index) => add(`learningGoals[${index + 1}]`, goal));
  add("briefing.scenario", entry.briefing.scenario);
  add("briefing.role", entry.briefing.role);
  add("briefing.authorization", entry.briefing.authorization);
  entry.beats.forEach((beat, index) => add(`beats[${index + 1}].text`, beat.text));

  for (const objective of entry.objectives) {
    const at = `objectives[${objective.id}]`;
    if (objective.name !== undefined) add(`${at}.name`, objective.name);
    add(`${at}.description`, objective.description);
    add(`${at}.why`, objective.why);
    add(`${at}.success`, objective.success);
    checkCopy(objective.check, `${at}.check`, add);
  }

  for (const [objectiveId, tiers] of Object.entries(entry.hints)) {
    tiers.forEach((hint, index) => add(`hints.${objectiveId}[${index + 1}]`, hint));
  }

  for (const question of entry.report.questions) {
    const at = `report.questions[${question.id}]`;
    add(`${at}.ask`, question.ask);
    add(`${at}.explain`, question.explain);
    question.choices?.forEach((choice, index) => add(`${at}.choices[${index + 1}]`, choice));
    question.feedback?.forEach((item, index) =>
      add(`${at}.feedback[${index + 1}].text`, item.text),
    );
  }

  const { debrief } = entry;
  add("debrief.summary", debrief.summary);
  debrief.whatYouLearned.forEach((line, index) =>
    add(`debrief.whatYouLearned[${index + 1}]`, line),
  );
  add("debrief.ethicsNote", debrief.ethicsNote);
  add("debrief.defensiveTakeaway", debrief.defensiveTakeaway);
  add("debrief.nextTease", debrief.nextTease);

  return copy;
}

/** A group's checks are walked so the choices inside one are checked too. */
function checkCopy(
  check: ObjectiveCheck,
  path: string,
  add: (path: string, text: string) => void,
): void {
  if (check.kind === "all" || check.kind === "any") {
    check.of.forEach((inner, index) => checkCopy(inner, `${path}.of[${index + 1}]`, add));
    return;
  }
  if (check.kind === "answer") {
    check.choices?.forEach((choice, index) => add(`${path}.choices[${index + 1}]`, choice));
  }
}
