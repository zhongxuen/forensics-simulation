import { describe, expect, it } from "vitest";
import { caseState, type CaseSummary } from "@/features/cases";
import type { CaseRunSave } from "@/lib/case-storage";
import { FIRST_STEP } from "@/lib/next-step";
import { nextStepFor, type NextStepCase } from "@/lib/next-step-from-runs";

const CHAPTER: readonly NextStepCase[] = [
  { id: "case-01", number: 1, title: "The clean copy", objectives: ["a", "b", "c", "d", "e"] },
  { id: "case-02", number: 2, title: "The deleted invoice", objectives: ["f", "g"] },
];

function run(changes: Partial<CaseRunSave> = {}): CaseRunSave {
  return {
    phase: "workspace",
    log: [],
    pins: [],
    notes: "",
    reportDraft: {},
    completed: [],
    hintsShown: {},
    beatsPlayed: [],
    citations: {},
    pinNotes: {},
    marks: [],
    savedAt: 1,
    ...changes,
  };
}

describe("nextStepFor", () => {
  it("starts at Case 1 with nothing saved", () => {
    expect(nextStepFor({}, CHAPTER)).toBe(FIRST_STEP);
  });

  it("continues a case in progress, counting its main objectives", () => {
    const step = nextStepFor({ "case-01": run({ completed: ["a", "bonus"] }) }, CHAPTER);
    expect(step).toMatchObject({
      href: "/cases/case-01",
      title: "Continue Case 1 · 1 of 5",
      detail: "The clean copy",
    });
  });

  it("continues the case saved most recently when several are in progress", () => {
    const step = nextStepFor(
      { "case-01": run({ savedAt: 5 }), "case-02": run({ savedAt: 9 }) },
      CHAPTER,
    );
    expect(step.href).toBe("/cases/case-02");
  });

  it("opens the next case once one is closed, and the sandbox once all are", () => {
    const closed = run({ phase: "debrief" });
    expect(nextStepFor({ "case-01": closed }, CHAPTER)).toMatchObject({
      href: "/cases/case-02",
      title: "Open Case 2",
    });
    expect(nextStepFor({ "case-01": closed, "case-02": closed }, CHAPTER).href).toBe("/sandbox");
  });

  it("ignores saves for cases outside the chapter (the practice case)", () => {
    expect(nextStepFor({ practice: run() }, CHAPTER)).toBe(FIRST_STEP);
  });
});

describe("caseState", () => {
  const summary: CaseSummary = {
    id: "case-01",
    title: "The clean copy",
    summary: "",
    number: 1,
    minutes: 15,
    objectives: ["a", "b", "c"],
    released: true,
  };

  it("reads not started, in progress and closed from the save", () => {
    expect(caseState(summary, undefined)).toEqual({ kind: "not-started" });
    expect(caseState(summary, run({ phase: "report", completed: ["a", "b"] }))).toEqual({
      kind: "in-progress",
      done: 2,
      total: 3,
    });
    expect(
      caseState(
        summary,
        run({
          phase: "debrief",
          marks: [
            { after: 3, kind: "submitted", supported: 1, total: 3 },
            { after: 4, kind: "pinned", ref: "log:security/57" },
            { after: 5, kind: "submitted", supported: 3, total: 3 },
          ],
        }),
      ),
    ).toEqual({ kind: "closed", supported: 3, total: 3 });
  });

  it("says closed without a count when the save recorded no submission", () => {
    expect(caseState(summary, run({ phase: "debrief" }))).toEqual({ kind: "closed" });
  });
});
