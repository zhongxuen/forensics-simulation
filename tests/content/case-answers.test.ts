import { describe, expect, it } from "vitest";
import { resolveRef } from "@/sim";
import { answerIntegrityProblems, builtCases, committedEvidence } from "./support";

/**
 * Group 6 of docs/plan/03-case-format-and-generator.md §Tests: **answer integrity**.
 *
 * A report question ships with its own answer key, and the key is written by hand while the story
 * is the ground truth — so the two can drift apart, and a player who reads the evidence correctly
 * would be told they are wrong. `answerFrom` names the story action that decides an answer, and
 * this is what holds the two together.
 *
 * The second half of the same idea is `acceptedEvidence`: an answer has to point at evidence that
 * is really there. A pattern matching nothing already fails the build; here the resolved refs are
 * checked against the evidence that ships.
 */
describe.each(builtCases.map((built) => [built.case.id, built] as const))("%s", (id, built) => {
  it("gives every answer that names a story action the time that action happened", () => {
    expect(answerIntegrityProblems(built.case)).toEqual([]);
  });

  it("names the deciding story action for every timestamp it asks about", () => {
    for (const question of built.case.report.questions) {
      if (question.type !== "timestamp") continue;
      expect(
        question.answerFrom,
        `report.questions[${question.id}] asks for a time but names no story action. Add answerFrom, so a test can check the two still agree.`,
      ).toBeDefined();
    }
  });

  it("builds evidence its report questions can actually point at", () => {
    const evidence = committedEvidence(id) ?? built.evidence;
    for (const question of built.case.report.questions) {
      const refs = built.acceptedRefs.get(question.id) ?? [];
      expect(refs.length, `${question.id} matches nothing`).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(resolveRef(evidence, ref), `${question.id}: ${ref}`).toBeDefined();
      }
    }
  });

  it("never lets the noise answer a question for the player", () => {
    // Noise that matched a question's accepted evidence would put a supporting artefact on the
    // board for a reason nobody wrote (03 §Noise profiles).
    const fromStory = new Set<string>(
      built.result.trace
        .filter((entry) => entry.source === "story")
        .flatMap((entry) => entry.artefacts.map((artefact) => artefact.ref)),
    );
    for (const question of built.case.report.questions) {
      for (const ref of built.acceptedRefs.get(question.id) ?? []) {
        expect(
          fromStory.has(ref),
          `${question.id} accepts ${ref}, which no story action left. Tighten the pattern, or put the artefact in the story.`,
        ).toBe(true);
      }
    }
  });
});
