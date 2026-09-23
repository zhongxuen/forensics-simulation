import type { CasePlayResult } from "./play";

/**
 * A readable transcript of a played case: the opening lines, then each step with its output, the
 * objectives it ticked and the story it played, then where the run ended up. `pnpm case:play`
 * prints it, and a failing solvability test shows it, so "the case stopped completing" is followed
 * by the run that stopped completing.
 */
export function formatCasePlay(result: CasePlayResult): string {
  const entry = result.case;
  const lines: string[] = [`${entry.title} (${entry.id}, version ${entry.version})`, ""];
  const objective = (id: string) => entry.objectives.find((candidate) => candidate.id === id);
  const story = (entries: readonly string[]) =>
    entries.forEach((line) => lines.push(`  » ${line}`));

  story(result.opening);
  for (const step of result.steps) {
    lines.push("");
    lines.push(step.output === "" ? "[no output]" : step.output);
    if (step.problem !== undefined) lines.push(`  ! ${step.problem}`);
    for (const id of step.ticked) {
      const done = objective(id);
      const label = done?.name ? `${done.name} (${done.hidden ? "secret" : "bonus"})` : id;
      lines.push(`  ✓ ${label}: ${done?.success ?? ""}`);
    }
    story(step.story);
  }

  const main = entry.objectives.filter((candidate) => !candidate.optional);
  const extras = entry.objectives.filter((candidate) => candidate.optional);
  const done = new Set(result.completed);
  const supported = result.report.filter((grade) => grade.verdict === "supported").length;

  lines.push(
    "",
    result.complete ? "CASE COMPLETE" : "Case not complete",
    `Main objectives: ${main.filter((item) => done.has(item.id)).length} of ${main.length}`,
    `Bonus objectives and secrets: ${extras.filter((item) => done.has(item.id)).length} of ${extras.length}`,
    `Report findings supported: ${supported} of ${result.report.length}`,
  );
  for (const grade of result.report) {
    const where = grade.supportedBy.length > 0 ? ` (${grade.supportedBy.join(", ")})` : "";
    lines.push(`  ${mark(grade.verdict)} ${grade.questionId}: ${grade.verdict}${where}`);
  }
  if (result.pins.length > 0) lines.push(`On the board: ${result.pins.join(", ")}`);

  const missing = main.filter((item) => !done.has(item.id)).map((item) => item.id);
  if (missing.length > 0) lines.push(`Still to do: ${missing.join(", ")}`);
  return lines.join("\n");
}

const mark = (verdict: string): string =>
  verdict === "supported" ? "✓" : verdict === "needs-evidence" ? "!" : "·";
