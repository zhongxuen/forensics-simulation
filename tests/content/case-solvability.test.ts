import { describe, expect, it } from "vitest";
import {
  formatCasePlay,
  loadPlaythrough,
  mainObjectiveIds,
  playCase,
  playthroughPath,
  verifyPlaythrough,
} from "@/features/cases/server";
import { builtCases } from "./support";

/**
 * Group 5 of docs/plan/03-case-format-and-generator.md §Tests: **solvability**.
 *
 * A case nobody can finish is not a case. Each one ships with a playthrough — the scripted run in
 * `src/content/cases/playthroughs/<id>.yaml` — and this plays it through the same parser, engine
 * and tool registry the browser uses. It has to reach every main objective and leave every report
 * question **supported**: answered, and pointing at evidence on the board.
 *
 * Because it goes through the registry, a tool added in `src/sim/tools/forensics/index.ts` is
 * usable from a playthrough the moment it is registered, and nothing here needs changing. And
 * because the story is what the evidence is built from, moving one action by an hour can break the
 * way through — which is exactly what this is here to catch, before a player does.
 */
describe.each(builtCases.map((built) => [built.case.id, built] as const))("%s", (id, built) => {
  const playthrough = loadPlaythrough(id, built.case.playthrough);

  it("has a playthrough that proves it can be finished", () => {
    expect(
      playthrough,
      `${id} has no playthrough, so nothing proves it can be finished. Add ${playthroughPath(id, built.case.playthrough)} (pnpm case:new writes one).`,
    ).toBeDefined();
  });

  it("plays exactly as its playthrough says", () => {
    if (!playthrough) return;
    const { result, problems } = verifyPlaythrough(built, playthrough);
    expect(problems, problems.length > 0 ? formatCasePlay(result) : "").toEqual([]);
  });

  it("reaches every main objective and supports every finding", () => {
    if (!playthrough) return;
    const result = playCase(built, playthrough.steps);
    expect(result.completed).toEqual(expect.arrayContaining(mainObjectiveIds(built.case)));
    expect(result.report.map((grade) => `${grade.questionId}: ${grade.verdict}`)).toEqual(
      built.case.report.questions.map((question) => `${question.id}: supported`),
    );
  });

  it("is not already finished before the playthrough starts", () => {
    // An objective that ticks with nothing done is an objective nobody has to do.
    expect(playCase(built, []).completed).toEqual([]);
  });
});
