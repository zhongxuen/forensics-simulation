import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCase, toCaseSpec } from "@/features/cases/server";
import { generate, stableStringify } from "@/sim";
import { builtCases, catalog, EVIDENCE_DIR, readIfThere, stalenessProblems } from "./support";

/**
 * Groups 3 and 4 of docs/plan/03-case-format-and-generator.md §Tests: **staleness** and
 * **determinism**.
 *
 * The generator is pure and seeded, so one story has exactly one evidence set, for ever. Those two
 * facts are what make `pnpm evidence:check` meaningful: if regenerating can only ever give the same
 * bytes, then bytes that differ mean somebody edited a story and didn't rebuild — not that the
 * generator drifted. Neither check is worth much without the other.
 */
describe.each(builtCases.map((built) => [built.case.id, built] as const))("%s", (id, built) => {
  it("has the evidence committed beside it that its story builds today", () => {
    const committed = readIfThere(join(EVIDENCE_DIR, id, "evidence.json"));
    expect(stalenessProblems(built, committed)).toEqual([]);
  });

  it("has the answer key committed beside it that its report resolves to today", () => {
    const committed = readIfThere(join(EVIDENCE_DIR, id, "answers.json"));
    expect(
      committed,
      `${id}/answers.json is out of date or missing. Run \`pnpm evidence:build\`.`,
    ).toBeDefined();
    const parsed = JSON.parse(committed ?? "{}") as {
      caseId: string;
      version: number;
      questions: { id: string; acceptedRefs: string[] }[];
    };
    expect(parsed.caseId).toBe(id);
    expect(parsed.version).toBe(built.case.version);
    for (const question of parsed.questions) {
      expect(question.acceptedRefs, `${question.id} points at nothing`).toEqual(
        built.acceptedRefs.get(question.id),
      );
    }
  });

  it("builds the same bytes twice in one process", () => {
    const spec = toCaseSpec(built.case);
    expect(stableStringify(generate(spec).evidence)).toBe(stableStringify(generate(spec).evidence));
  });

  it("builds the same bytes through the loader as through the generator", () => {
    expect(stableStringify(buildCase(built.case).evidence)).toBe(stableStringify(built.evidence));
  });

  it("stays small enough to load without spoiling a page's budget", () => {
    const bytes = Buffer.byteLength(stableStringify(built.evidence));
    expect(bytes, `${id}'s evidence is ${(bytes / 1024).toFixed(0)} KB`).toBeLessThan(400 * 1024);
  });
});

describe("the evidence folder", () => {
  it("holds evidence for every case, and for nothing else", () => {
    const ids = new Set(catalog.all.map((entry) => entry.id));
    const folders = readdirSync(EVIDENCE_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    for (const name of folders) {
      expect(
        ids.has(name),
        `src/content/evidence/${name} has no case any more. Run \`pnpm evidence:build\` to clear it out.`,
      ).toBe(true);
    }
    for (const id of ids) {
      expect(folders, `${id} has never been built. Run \`pnpm evidence:build\`.`).toContain(id);
    }
  });
});
