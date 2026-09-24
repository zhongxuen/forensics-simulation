import { describe, expect, it } from "vitest";
import {
  caseRunReducer,
  createCaseRun,
  evaluateObjectives,
  gradeQuestion,
  gradeReport,
  parseAnswerTime,
  PRACTICE_CASE,
  supportedCount,
  type CaseReportQuestion,
  type RunnableCase,
} from "@/features/cases";
import { createTerminalSession } from "@/features/terminal";
import type { SimEvent } from "@/sim/types";

const NOTE = "disk:qf-lt-03:mft/46";

const WHEN: CaseReportQuestion = {
  id: "note-created",
  ask: "When was the note created?",
  type: "timestamp",
  answer: "2026-04-11T19:44:37Z",
  answerAt: Date.UTC(2026, 3, 11, 19, 44, 37),
  toleranceSeconds: 60,
  acceptedRefs: [NOTE],
  explain: "Two sources agree.",
};

const WHICH: CaseReportQuestion = {
  id: "which-hash",
  ask: "Which hash?",
  type: "choice",
  choices: ["SHA-256", "MD5"],
  answer: "SHA-256",
  acceptedRefs: [NOTE],
  explain: "The one on the form.",
};

describe("gradeQuestion", () => {
  it("is not yet with no answer, or the wrong one", () => {
    expect(gradeQuestion(WHICH, undefined, [NOTE]).verdict).toBe("not-yet");
    expect(gradeQuestion(WHICH, "  ", [NOTE]).verdict).toBe("not-yet");
    expect(gradeQuestion(WHICH, "MD5", [NOTE]).verdict).toBe("not-yet");
  });

  it("needs evidence when the answer is right but nothing pinned backs it", () => {
    expect(gradeQuestion(WHICH, "SHA-256", []).verdict).toBe("needs-evidence");
    expect(gradeQuestion(WHICH, "SHA-256", ["disk:qf-lt-03:mft/12"]).verdict).toBe(
      "needs-evidence",
    );
  });

  it("is supported when the answer is right and on the board", () => {
    const grade = gradeQuestion(WHICH, " sha-256 ", ["disk:qf-lt-03:mft/12", NOTE]);
    expect(grade).toEqual({ questionId: "which-hash", verdict: "supported", supportedBy: [NOTE] });
  });

  it("reads a time with its zone, within the question's tolerance", () => {
    expect(gradeQuestion(WHEN, "2026-04-11T19:44:37Z", [NOTE]).verdict).toBe("supported");
    expect(gradeQuestion(WHEN, "2026-04-11 20:45:30+01:00", [NOTE]).verdict).toBe("supported");
    expect(gradeQuestion(WHEN, "2026-04-11T19:46:00Z", [NOTE]).verdict).toBe("not-yet");
    // Without a zone it means a different moment on every machine, so it isn't read at all.
    expect(gradeQuestion(WHEN, "2026-04-11 19:44:37", [NOTE]).verdict).toBe("not-yet");
  });

  it("counts supported findings, never anything that goes down", () => {
    const grades = gradeReport(
      { questions: [WHEN, WHICH] },
      { "note-created": "2026-04-11T19:44:37Z", "which-hash": "MD5" },
      [NOTE],
    );
    expect(grades.map((grade) => grade.verdict)).toEqual(["supported", "not-yet"]);
    expect(supportedCount(grades)).toBe(1);
  });
});

describe("parseAnswerTime", () => {
  it("takes the tools' own format and an offset, and refuses a time without a zone", () => {
    expect(parseAnswerTime("2026-04-11t19:44:37z")).toBe(Date.UTC(2026, 3, 11, 19, 44, 37));
    expect(parseAnswerTime("2026-04-11 20:44+01:00")).toBe(Date.UTC(2026, 3, 11, 19, 44));
    expect(parseAnswerTime("Saturday evening")).toBeUndefined();
    expect(parseAnswerTime("2026-04-11T19:44:37")).toBeUndefined();
  });
});

/** The practice case with forensics objectives: a pin, a group, and a supported answer. */
const FORENSIC: RunnableCase = {
  ...PRACTICE_CASE,
  id: "forensic-test",
  objectives: [
    {
      id: "pin-note",
      description: "Pin the note.",
      why: "Why.",
      success: "Pinned.",
      hints: ["a", "b", "c"],
      check: {
        kind: "all",
        of: [
          { kind: "commandRun", pattern: "^ls\\b" },
          { kind: "pinned", refs: [NOTE] },
        ],
      },
    },
    {
      id: "report-time",
      description: "Say when.",
      why: "Why.",
      success: "Reported.",
      hints: ["a", "b", "c"],
      check: { kind: "reported", question: "note-created" },
    },
    {
      id: "either",
      description: "Either.",
      why: "Why.",
      success: "Done.",
      optional: true,
      hints: [],
      check: {
        kind: "any",
        of: [
          { kind: "pinned", refs: ["log:security/1"] },
          { kind: "commandRun", pattern: "^cat\\b" },
        ],
      },
    },
  ],
  story: [],
  report: { questions: [WHEN] },
};

describe("the forensics objective checks", () => {
  const ls: SimEvent = { type: "command.run", command: "ls", line: "ls", exitCode: 0 };

  it("hold on what is pinned and reported, not on commands alone", () => {
    expect(evaluateObjectives(FORENSIC, [ls])).toEqual([]);
    expect(evaluateObjectives(FORENSIC, [ls], { pins: [NOTE], reportDraft: {} })).toEqual([
      "pin-note",
    ]);
    expect(
      evaluateObjectives(FORENSIC, [], {
        pins: [NOTE],
        reportDraft: { "note-created": "2026-04-11T19:44:37Z" },
      }),
    ).toEqual(["report-time"]);
  });

  it("tick in the reducer when a pin or an answer arrives, and stay ticked", () => {
    const { sim } = createTerminalSession({ scenario: FORENSIC.scenario, seed: FORENSIC.seed });
    let run = caseRunReducer(FORENSIC, createCaseRun(), { type: "start", sim });
    run = caseRunReducer(FORENSIC, run, { type: "command", events: [ls], sim });
    expect(run.completed).toEqual([]);

    run = caseRunReducer(FORENSIC, run, { type: "pin", ref: NOTE });
    expect(run.completed).toEqual(["pin-note"]);

    run = caseRunReducer(FORENSIC, run, {
      type: "draft",
      questionId: "note-created",
      text: "2026-04-11T19:44:37Z",
    });
    expect(run.completed).toEqual(["pin-note", "report-time"]);

    run = caseRunReducer(FORENSIC, run, { type: "unpin", ref: NOTE });
    expect(run.completed).toEqual(["pin-note", "report-time"]);
  });
});
