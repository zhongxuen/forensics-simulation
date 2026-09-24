import type { CaseReportQuestion, CaseReportSpec } from "./case-definition";

/**
 * Grading the report in the browser (docs/plan/00-overview.md §4, row 7): no score, three
 * verdicts. The same rules as headless play's `grade` (loader/play.ts), over the runner's own view
 * of a question, so the report a player writes is graded exactly the way the solvability test
 * grades the playthrough's.
 *
 * - **supported**: the answer is right, and something on the board backs it up.
 * - **needs evidence**: the answer is right, but nothing pinned points at it yet. Not a failure:
 *   the habit being taught is that a finding carries its evidence, and the way to learn it is to
 *   be told what's missing.
 * - **not yet**: no answer, or not this one. Retry freely.
 */
export type ReportVerdict = "supported" | "needs-evidence" | "not-yet";

export interface QuestionGrade {
  readonly questionId: string;
  readonly verdict: ReportVerdict;
  /** The pinned refs that back the answer up, oldest pin first. */
  readonly supportedBy: readonly string[];
}

/** One question's verdict, given the draft answer and what's on the board. */
export function gradeQuestion(
  question: CaseReportQuestion,
  answer: string | undefined,
  pins: readonly string[],
): QuestionGrade {
  const supportedBy = pins.filter((ref) => question.acceptedRefs.includes(ref));
  const base = { questionId: question.id, supportedBy };
  if (answer === undefined || answer.trim() === "" || !answers(question, answer)) {
    return { ...base, verdict: "not-yet" };
  }
  return { ...base, verdict: supportedBy.length > 0 ? "supported" : "needs-evidence" };
}

/** Every question's verdict, in the report's order. */
export function gradeReport(
  report: CaseReportSpec,
  draft: Readonly<Record<string, string>>,
  pins: readonly string[],
): QuestionGrade[] {
  return report.questions.map((question) => gradeQuestion(question, draft[question.id], pins));
}

/** "n of m findings supported": never a number that can go down for asking for help. */
export function supportedCount(grades: readonly QuestionGrade[]): number {
  return grades.filter((grade) => grade.verdict === "supported").length;
}

/** Whether what the player wrote is the answer, by the question's kind. */
function answers(question: CaseReportQuestion, given: string): boolean {
  if (question.type === "timestamp") {
    const got = parseAnswerTime(given);
    if (question.answerAt === undefined || got === undefined) return false;
    return Math.abs(got - question.answerAt) <= (question.toleranceSeconds ?? 0) * 1000;
  }
  if (question.type === "evidence-pick") {
    return question.acceptedRefs.some((ref) => same(ref, given));
  }
  return same(question.answer, given);
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The case schema's rule (`parseCaseTime`): a time only means something with its zone. */
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/i;

/**
 * An instant from a time the player typed, written with its zone: `2026-04-11T19:44:37Z`, or
 * `2026-04-11 20:44:37+01:00`. Undefined for a time without one, which would mean a different
 * moment on every machine. The case schema's `parseCaseTime` is the same rule, but its module
 * brings the whole schema (and full Zod) with it, which browser code may not.
 */
export function parseAnswerTime(value: string): number | undefined {
  const trimmed = value.trim();
  if (!ISO_WITH_ZONE.test(trimmed)) return undefined;
  const ms = Date.parse(trimmed.replace(" ", "T").toUpperCase());
  return Number.isFinite(ms) ? ms : undefined;
}
