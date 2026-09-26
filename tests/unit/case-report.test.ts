import { describe, expect, it } from "vitest";
import {
  caseRunReducer,
  createCaseRun,
  evaluateObjectives,
  gradeQuestion,
  gradeReport,
  parseAnswerTime,
  PRACTICE_CASE,
  reportAnswers,
  supportedCount,
  type CaseReportQuestion,
  type CaseRunAction,
  type CaseRunState,
  type RunnableCase,
} from "@/features/cases";
import { createTerminalSession } from "@/features/terminal";
import type { SimEvent } from "@/sim/types";

/**
 * The report grader (docs/plan/10-case-board-report-custody.md §Grading): every question type,
 * the tolerance edges, and the four ways an answer can fall short of supported. The rule under
 * test is the one that makes it forensics: a right answer that cites nothing that proves it is
 * never supported.
 */

const NOTE = "disk:qf-lt-03:mft/46";
const MONITOR = "log:sysmon-lite/12";
const OTHER = "disk:qf-lt-03:mft/12";
const LOGON = "log:security/57";
const BOARD = [OTHER, NOTE, MONITOR, LOGON];

const AT = Date.UTC(2026, 3, 11, 19, 44, 37);

const WHEN: CaseReportQuestion = {
  id: "note-created",
  ask: "When was the note created?",
  type: "timestamp",
  answer: "2026-04-11T19:44:37Z",
  answerAt: AT,
  toleranceSeconds: 60,
  acceptedRefs: [NOTE, MONITOR],
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

const PICK: CaseReportQuestion = {
  id: "which-record",
  ask: "Which record is the note?",
  type: "evidence-pick",
  answer: NOTE,
  acceptedRefs: [NOTE],
  explain: "Its record.",
};

const ACCOUNT: CaseReportQuestion = {
  id: "which-account",
  ask: "Which account signed in?",
  type: "account",
  answer: "mara",
  acceptedRefs: [LOGON],
  explain: "The logon record names it.",
};

const HOST: CaseReportQuestion = {
  id: "which-host",
  ask: "Which machine?",
  type: "host",
  answer: "qf-lt-03",
  acceptedRefs: [LOGON],
  explain: "The record's computer field.",
};

const grade = (question: CaseReportQuestion, value?: string, cited?: string[], pins = BOARD) =>
  gradeQuestion(question, { ...(value !== undefined && { value }), ...(cited && { cited }) }, pins);

describe("gradeQuestion: the three verdicts", () => {
  it("is not yet with no answer, a blank one, or the wrong one, however well cited", () => {
    expect(gradeQuestion(WHICH, undefined, BOARD)).toMatchObject({
      verdict: "not-yet",
      reason: "unanswered",
    });
    expect(grade(WHICH, "   ", [NOTE])).toMatchObject({ verdict: "not-yet", reason: "unanswered" });
    expect(grade(WHICH, "MD5", [NOTE])).toMatchObject({ verdict: "not-yet", reason: "incorrect" });
  });

  it("is never supported when the answer is right but cites nothing (correct but uncited)", () => {
    // Everything the question accepts is on the board, and it still isn't enough on its own.
    expect(grade(WHICH, "SHA-256")).toMatchObject({
      verdict: "needs-evidence",
      reason: "uncited",
      cited: [],
      supportedBy: [],
    });
    expect(grade(WHICH, "SHA-256", [])).toMatchObject({ verdict: "needs-evidence" });
  });

  it("needs evidence when the answer is right and cites something that doesn't prove it (cited but irrelevant)", () => {
    expect(grade(WHICH, "SHA-256", [OTHER, LOGON])).toMatchObject({
      verdict: "needs-evidence",
      reason: "irrelevant",
      cited: [OTHER, LOGON],
      supportedBy: [],
    });
  });

  it("stays not yet when the answer is wrong but the right evidence is cited (cited but wrong)", () => {
    expect(grade(WHICH, "MD5", [NOTE])).toMatchObject({
      verdict: "not-yet",
      reason: "incorrect",
      supportedBy: [NOTE],
    });
  });

  it("is supported when the answer is right and a cited pin proves it", () => {
    expect(grade(WHICH, " sha-256 ", [OTHER, NOTE])).toEqual({
      questionId: "which-hash",
      verdict: "supported",
      reason: "supported",
      cited: [OTHER, NOTE],
      supportedBy: [NOTE],
    });
  });

  it("only counts a citation while its pin is on the board", () => {
    expect(grade(WHICH, "SHA-256", [NOTE], [OTHER])).toMatchObject({
      verdict: "needs-evidence",
      reason: "uncited",
      cited: [],
    });
  });

  it("counts a pin cited twice once", () => {
    expect(grade(WHICH, "SHA-256", [NOTE, NOTE]).cited).toEqual([NOTE]);
  });
});

describe("gradeQuestion: every question type", () => {
  it("choice: the answer's words, ignoring case and spaces at the ends", () => {
    expect(grade(WHICH, "sha-256", [NOTE]).verdict).toBe("supported");
    expect(grade(WHICH, "SHA256", [NOTE]).verdict).toBe("not-yet");
  });

  it("account and host: the name the evidence writes, ignoring case", () => {
    expect(grade(ACCOUNT, "MARA", [LOGON]).verdict).toBe("supported");
    expect(grade(ACCOUNT, "dana", [LOGON]).verdict).toBe("not-yet");
    expect(grade(ACCOUNT, "mara", [NOTE]).verdict).toBe("needs-evidence");
    expect(grade(HOST, " qf-lt-03 ", [LOGON]).verdict).toBe("supported");
    expect(grade(HOST, "qf-lt-07", [LOGON]).verdict).toBe("not-yet");
  });

  it("evidence-pick: picking the right pinned item answers it and cites it", () => {
    expect(grade(PICK, NOTE)).toMatchObject({ verdict: "supported", cited: [NOTE] });
    expect(grade(PICK, OTHER)).toMatchObject({ verdict: "not-yet", reason: "incorrect" });
    // Right, but taken off the board since: nothing on the board proves it any more.
    expect(grade(PICK, NOTE, [], [OTHER])).toMatchObject({
      verdict: "needs-evidence",
      reason: "uncited",
    });
  });

  it("timestamp: any source the question accepts can back it up", () => {
    expect(grade(WHEN, "2026-04-11T19:44:37Z", [MONITOR]).verdict).toBe("supported");
    expect(grade(WHEN, "2026-04-11T19:44:37Z", [NOTE]).verdict).toBe("supported");
  });
});

describe("gradeQuestion: timestamp tolerance", () => {
  const at = (offsetMs: number) => new Date(AT + offsetMs).toISOString().replace(".000Z", "Z");

  it("accepts exactly the tolerance either way, and refuses a second past it", () => {
    expect(grade(WHEN, at(60_000), [NOTE]).verdict).toBe("supported");
    expect(grade(WHEN, at(-60_000), [NOTE]).verdict).toBe("supported");
    expect(grade(WHEN, at(61_000), [NOTE]).verdict).toBe("not-yet");
    expect(grade(WHEN, at(-61_000), [NOTE]).verdict).toBe("not-yet");
  });

  it("refuses a millisecond past the edge", () => {
    expect(grade(WHEN, "2026-04-11T19:45:37.001Z", [NOTE]).verdict).toBe("not-yet");
    expect(grade(WHEN, "2026-04-11T19:45:37.000Z", [NOTE]).verdict).toBe("supported");
  });

  it("with no tolerance, wants the exact second", () => {
    const withoutTolerance: CaseReportQuestion = {
      id: WHEN.id,
      ask: WHEN.ask,
      type: "timestamp",
      answer: WHEN.answer,
      answerAt: AT,
      acceptedRefs: WHEN.acceptedRefs,
      explain: WHEN.explain,
    };
    expect(grade(withoutTolerance, "2026-04-11T19:44:37Z", [NOTE]).verdict).toBe("supported");
    expect(grade(withoutTolerance, "2026-04-11T19:44:38Z", [NOTE]).verdict).toBe("not-yet");
  });

  it("reads the same instant written in another zone, and refuses one written without a zone", () => {
    expect(grade(WHEN, "2026-04-11 20:44:37+01:00", [NOTE]).verdict).toBe("supported");
    expect(grade(WHEN, "2026-04-11 19:44:37", [NOTE]).verdict).toBe("not-yet");
    expect(grade(WHEN, "Saturday evening", [NOTE]).verdict).toBe("not-yet");
  });

  it("falls back to the written answer when the question has no instant", () => {
    const fromText: CaseReportQuestion = {
      id: WHEN.id,
      ask: WHEN.ask,
      type: "timestamp",
      answer: WHEN.answer,
      toleranceSeconds: 60,
      acceptedRefs: WHEN.acceptedRefs,
      explain: WHEN.explain,
    };
    expect(grade(fromText, "2026-04-11T19:45:00Z", [NOTE]).verdict).toBe("supported");
  });
});

describe("parseAnswerTime", () => {
  it("takes the tools' own format and an offset, and refuses a time without a zone", () => {
    expect(parseAnswerTime("2026-04-11t19:44:37z")).toBe(AT);
    expect(parseAnswerTime("2026-04-11 20:44+01:00")).toBe(Date.UTC(2026, 3, 11, 19, 44));
    expect(parseAnswerTime("Saturday evening")).toBeUndefined();
    expect(parseAnswerTime("2026-04-11T19:44:37")).toBeUndefined();
  });
});

describe("gradeReport", () => {
  it("grades every question in order, and counts the supported ones", () => {
    const findings = gradeReport(
      { questions: [WHEN, WHICH, ACCOUNT] },
      reportAnswers(
        { "note-created": "2026-04-11T19:44:37Z", "which-hash": "MD5", "which-account": "mara" },
        { "note-created": [NOTE] },
      ),
      BOARD,
    );
    expect(findings.map((finding) => finding.verdict)).toEqual([
      "supported",
      "not-yet",
      "needs-evidence",
    ]);
    expect(supportedCount(findings)).toBe(1);
  });

  it("joins the draft and the citations, either one alone included", () => {
    expect(reportAnswers({ a: "x" }, { b: [NOTE] })).toEqual({
      a: { value: "x" },
      b: { cited: [NOTE] },
    });
  });
});

/** The practice case with a report: a pin objective, and a reported one. */
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
  report: { questions: [WHEN, WHICH] },
};

const ls: SimEvent = { type: "command.run", command: "ls", line: "ls", exitCode: 0 };

function play(actions: readonly CaseRunAction[]): CaseRunState {
  const { sim } = createTerminalSession({ scenario: FORENSIC.scenario, seed: FORENSIC.seed });
  return actions.reduce(
    (run, action) => caseRunReducer(FORENSIC, run, action),
    caseRunReducer(FORENSIC, createCaseRun(), { type: "start", sim }),
  );
}

const findings = (run: CaseRunState) =>
  gradeReport(
    FORENSIC.report ?? { questions: [] },
    reportAnswers(run.reportDraft, run.citations),
    run.pins,
  );

describe("the forensics objective checks", () => {
  it("hold on what is pinned and cited, not on commands alone", () => {
    expect(evaluateObjectives(FORENSIC, [ls])).toEqual([]);
    expect(evaluateObjectives(FORENSIC, [ls], { pins: [NOTE], reportDraft: {} })).toEqual([
      "pin-note",
    ]);
    const answered = { pins: [NOTE], reportDraft: { "note-created": "2026-04-11T19:44:37Z" } };
    expect(evaluateObjectives(FORENSIC, [], answered)).toEqual([]);
    expect(
      evaluateObjectives(FORENSIC, [], { ...answered, citations: { "note-created": [NOTE] } }),
    ).toEqual(["report-time"]);
  });

  it("tick in the reducer when a pin or a cited answer arrives, and stay ticked", () => {
    let run = play([{ type: "command", events: [ls], sim: play([]).sim! }]);
    expect(run.completed).toEqual([]);

    run = caseRunReducer(FORENSIC, run, { type: "pin", ref: NOTE });
    expect(run.completed).toEqual(["pin-note"]);

    run = caseRunReducer(FORENSIC, run, {
      type: "draft",
      questionId: "note-created",
      text: "2026-04-11T19:44:37Z",
    });
    expect(run.completed).toEqual(["pin-note"]);
    run = caseRunReducer(FORENSIC, run, { type: "cite", questionId: "note-created", refs: [NOTE] });
    expect(run.completed).toEqual(["pin-note", "report-time"]);

    run = caseRunReducer(FORENSIC, run, { type: "unpin", ref: NOTE });
    expect(run.completed).toEqual(["pin-note", "report-time"]);
  });
});

describe("resubmission", () => {
  const toReport: CaseRunAction[] = [
    { type: "command", events: [ls], sim: play([]).sim! },
    { type: "pin", ref: NOTE },
    { type: "draft", questionId: "note-created", text: "2026-04-11T19:44:37Z" },
    { type: "cite", questionId: "note-created", refs: [NOTE] },
    { type: "report" },
  ];

  it("can always go back, change an answer and submit again, and nothing is lost", () => {
    let run = play([
      ...toReport,
      { type: "draft", questionId: "which-hash", text: "SHA-256" },
      { type: "submitReport" },
    ]);
    expect(run.phase).toBe("debrief");
    expect(findings(run).map((finding) => finding.verdict)).toEqual([
      "supported",
      "needs-evidence",
    ]);

    for (let attempt = 0; attempt < 5; attempt++) {
      run = caseRunReducer(FORENSIC, run, { type: "resume" });
      run = caseRunReducer(FORENSIC, run, { type: "report" });
      expect(run.phase).toBe("report");
      run = caseRunReducer(FORENSIC, run, { type: "submitReport" });
      expect(run.phase).toBe("debrief");
    }
    // The answers and citations are all still there.
    expect(run.reportDraft).toEqual({
      "note-created": "2026-04-11T19:44:37Z",
      "which-hash": "SHA-256",
    });

    run = caseRunReducer(FORENSIC, run, { type: "resume" });
    run = caseRunReducer(FORENSIC, run, { type: "report" });
    run = caseRunReducer(FORENSIC, run, { type: "cite", questionId: "which-hash", refs: [NOTE] });
    run = caseRunReducer(FORENSIC, run, { type: "submitReport" });
    expect(supportedCount(findings(run))).toBe(2);

    // Every submission is on the custody record, with how it landed then.
    const submissions = run.marks.filter((mark) => mark.kind === "submitted");
    expect(submissions).toHaveLength(7);
    expect(submissions.at(0)).toMatchObject({ supported: 1, total: 2 });
    expect(submissions.at(-1)).toMatchObject({ supported: 2, total: 2 });
  });

  it("gives the same verdicts however many hints were shown", () => {
    const answers: CaseRunAction[] = [
      ...toReport,
      { type: "draft", questionId: "which-hash", text: "SHA-256" },
    ];
    const hints: CaseRunAction[] = [
      { type: "hint", objectiveId: "pin-note" },
      { type: "hint", objectiveId: "pin-note" },
      { type: "hint", objectiveId: "pin-note" },
      { type: "hint", objectiveId: "report-time" },
    ];
    const without = play([...answers, { type: "submitReport" }]);
    const withHints = play([...hints, ...answers, ...hints, { type: "submitReport" }]);
    expect(withHints.hintsShown).toEqual({ "pin-note": 3, "report-time": 2 });
    expect(findings(withHints)).toEqual(findings(without));
    expect(withHints.completed).toEqual(without.completed);
    expect(withHints.marks).toEqual(without.marks);
  });
});

describe("the board in the reducer", () => {
  it("keeps one pin per ref, notes it, and forgets the note when the pin goes", () => {
    let run = play([
      { type: "pin", ref: NOTE, note: "the note" },
      { type: "pin", ref: NOTE },
    ]);
    expect(run.pins).toEqual([NOTE]);
    expect(run.pinNotes).toEqual({ [NOTE]: "the note" });
    // Only the first pin is a custody entry: the second changed nothing.
    expect(run.marks).toEqual([{ after: 0, kind: "pinned", ref: NOTE }]);

    run = caseRunReducer(FORENSIC, run, { type: "pinNote", ref: NOTE, text: "rewritten" });
    expect(run.pinNotes).toEqual({ [NOTE]: "rewritten" });
    run = caseRunReducer(FORENSIC, run, { type: "pinNote", ref: NOTE, text: "  " });
    expect(run.pinNotes).toEqual({});
    run = caseRunReducer(FORENSIC, run, { type: "pinNote", ref: OTHER, text: "not pinned" });
    expect(run.pinNotes).toEqual({});

    run = caseRunReducer(FORENSIC, run, { type: "pinNote", ref: NOTE, text: "again" });
    run = caseRunReducer(FORENSIC, run, { type: "unpin", ref: NOTE });
    expect(run.pins).toEqual([]);
    expect(run.pinNotes).toEqual({});
  });

  it("takes a terminal pin's note as its first note, and keeps the player's own", () => {
    const pinned: SimEvent = {
      type: "board.pinned",
      ref: NOTE,
      line: "46 the-door",
      note: "from -m",
    };
    let run = play([{ type: "command", events: [pinned], sim: play([]).sim! }]);
    expect(run.pinNotes).toEqual({ [NOTE]: "from -m" });
    run = caseRunReducer(FORENSIC, run, { type: "pinNote", ref: NOTE, text: "mine" });
    run = caseRunReducer(FORENSIC, run, { type: "command", events: [pinned], sim: run.sim! });
    expect(run.pinNotes).toEqual({ [NOTE]: "mine" });
  });

  it("drops a question's citations when none are left, and never cites the same pin twice", () => {
    let run = play([{ type: "cite", questionId: "which-hash", refs: [NOTE, NOTE, OTHER] }]);
    expect(run.citations).toEqual({ "which-hash": [NOTE, OTHER] });
    run = caseRunReducer(FORENSIC, run, { type: "cite", questionId: "which-hash", refs: [] });
    expect(run.citations).toEqual({});
  });
});
