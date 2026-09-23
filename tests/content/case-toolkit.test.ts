import { describe, expect, it } from "vitest";
import { parsePlaythrough } from "@/content/cases/playthrough";
import {
  buildCase,
  formatCasePlay,
  parseCaseSource,
  parsePlaythroughSource,
  verifyPlaythrough,
} from "@/features/cases/server";
import { caseTemplate, playthroughTemplate, seedFor } from "../../scripts/lib/case-template";

/**
 * The authoring scripts (docs/plan/03-case-format-and-generator.md §Scripts).
 *
 * `pnpm case:new <id>` has one promise: what it writes already works. An author starts from a case
 * that validates, generates its evidence and plays to the end, and changes it a piece at a time —
 * rather than from a blank file, a schema and a guess. This is the test that keeps that promise as
 * the schema and the tools move under it.
 *
 * Nothing here writes to disk: the template is pure string building, so the whole check runs in
 * memory.
 */
const ID = "case-template-check";

describe("the case pnpm case:new writes", () => {
  const source = caseTemplate(ID);

  it("validates, plays its story and resolves its answer key", () => {
    expect(() => parseCaseSource(source, `${ID}.yaml`)).not.toThrow();
  });

  it("leaves a TODO in every piece of copy the author has to write", () => {
    const entry = parseCaseSource(source, `${ID}.yaml`);
    expect(entry.title).toMatch(/TODO/);
    expect(entry.hook).toMatch(/TODO/);
    expect(entry.client.letter).toMatch(/TODO/);
    expect(entry.briefing.scenario).toMatch(/TODO/);
    expect(entry.debrief.summary).toMatch(/TODO/);
    for (const goal of entry.learningGoals) expect(goal).toMatch(/TODO/);
  });

  it("writes none of the copy the author shouldn't have to", () => {
    // Objectives, hints and checks are the scaffold's real gift: they work as written.
    const entry = parseCaseSource(source, `${ID}.yaml`);
    for (const objective of entry.objectives) {
      expect(objective.description).not.toMatch(/TODO/);
      expect(objective.why).not.toMatch(/TODO/);
      for (const hint of entry.hints[objective.id] ?? []) expect(hint).not.toMatch(/TODO/);
    }
  });

  it("plays to the end with the playthrough beside it", () => {
    const entry = parseCaseSource(source, `${ID}.yaml`);
    const playthrough = parsePlaythroughSource(playthroughTemplate(ID), `${ID}.yaml`);
    const built = buildCase(entry);
    const { result, problems } = verifyPlaythrough(built, playthrough);

    expect(problems, problems.length > 0 ? formatCasePlay(result) : "").toEqual([]);
    expect(result.complete).toBe(true);
    expect(result.report.every((grade) => grade.verdict === "supported")).toBe(true);
  });

  it("gives each new case its own seed, and the same one every time", () => {
    expect(seedFor("case-04")).toBe(seedFor("case-04"));
    expect(seedFor("case-04")).not.toBe(seedFor("case-05"));
    expect(Number.isSafeInteger(seedFor("case-04"))).toBe(true);
    expect(seedFor("case-04")).toBeLessThanOrEqual(4_294_967_295);
  });
});

describe("the playthrough pnpm case:new writes", () => {
  it("is for the case beside it, and expects it to finish", () => {
    const result = parsePlaythrough(
      parsePlaythroughSource(playthroughTemplate(ID), `${ID}.yaml`) as unknown,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.playthrough.case).toBe(ID);
    expect(result.playthrough.expect.complete).toBe(true);
    expect(result.playthrough.expect.supported).toBe(true);
  });

  it("says which file it belongs to when the two don't match", () => {
    expect(() => parsePlaythroughSource(playthroughTemplate(ID), "another-case.yaml")).toThrowError(
      /named after the case it plays/,
    );
  });

  it("lists the kinds of step there are when one is written wrong", () => {
    const result = parsePlaythrough({ case: ID, steps: [{ type: "run", line: "ls" }] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.problems.join("\n")).toMatch(/Each step is one of/);
  });
});
