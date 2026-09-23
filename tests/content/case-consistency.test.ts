import { describe, expect, it } from "vitest";
import { builtCases, committedEvidence, consistencyProblems } from "./support";

/**
 * Group 2 of docs/plan/03-case-format-and-generator.md §Tests: **the evidence agrees with the
 * story that made it**.
 *
 * For every action in a case — the story's own, and the seeded noise around it — every artefact it
 * left has to be in the evidence that ships, recording the instant the action happened. That is
 * the promise the whole format rests on: a player following a timeline is following the story, and
 * an examiner who reads the evidence right can never be told they are wrong.
 *
 * It is checked against the **committed** evidence, not against the evidence rebuilt in memory,
 * because that is what a player meets. A story edited without a rebuild fails here as well as in
 * the staleness group, and says which action moved.
 */
describe.each(builtCases.map((built) => [built.case.id, built] as const))("%s", (id, built) => {
  it("leaves every artefact its story says it leaves, at the time it says", () => {
    const evidence = committedEvidence(id);
    expect(evidence, `${id} has no committed evidence. Run \`pnpm evidence:build\`.`).toBeDefined();
    expect(consistencyProblems(built.result, evidence ?? built.evidence)).toEqual([]);
  });

  it("writes down artefacts for the story, not only for the noise around it", () => {
    const story = built.result.trace.filter((entry) => entry.source === "story");
    expect(story.length).toBe(built.case.story.length);
    expect(story.some((entry) => entry.artefacts.length > 0)).toBe(true);
  });

  it("hands over every log source its story writes to", () => {
    expect(
      built.result.droppedSources,
      `${id}'s story writes to ${built.result.droppedSources.join(", ")}, which the case doesn't hand over. Add them to evidence.logs, or stop writing to them.`,
    ).toEqual([]);
  });
});
