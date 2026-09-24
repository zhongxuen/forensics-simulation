import type { CaseReportAnswerType } from "../run/case-definition";

/**
 * Grading the report (docs/plan/10-case-board-report-custody.md §Grading, and 00 §4 row 7): no
 * score, three verdicts, and one rule that makes it forensics — **a finding only counts when it
 * points at evidence**.
 *
 * - **supported**: the answer is right, **and** at least one pin the player cited for it is on the
 *   board and is in the question's accepted evidence.
 * - **needs evidence**: the answer is right, but nothing cited proves it: no citation at all, a
 *   citation of something that doesn't show it, or a citation of a pin taken off the board since.
 *   Not a failure: the habit being taught is that a finding carries its evidence.
 * - **not yet**: no answer, or not this one. Change it and submit again, as often as you like.
 *
 * Pure, and the only grader: the browser's report, the objective evaluator's `reported` check and
 * headless play (`loader/play.ts`) all call it, so a playthrough is graded exactly the way a player
 * is. Nothing here takes hints, the mentor or a count of attempts, so none of them can change a
 * verdict.
 */
export type ReportVerdict = "supported" | "needs-evidence" | "not-yet";

/** Why a finding got its verdict, for copy that says what to do next. */
export type FindingReason =
  /** Nothing written yet. */
  | "unanswered"
  /** Written, and not the answer. */
  | "incorrect"
  /** Right, but nothing on the board is cited for it. */
  | "uncited"
  /** Right, and something is cited, but nothing cited shows it. */
  | "irrelevant"
  | "supported";

/** What the grader needs from a question: its kind, the answer key and the accepted evidence. */
export interface GradableQuestion {
  readonly id: string;
  readonly type: CaseReportAnswerType;
  readonly answer: string;
  /** For a timestamp question: the instant the answer means. Read from `answer` when absent. */
  readonly answerAt?: number;
  /** For a timestamp question: how far off, either way, still counts. */
  readonly toleranceSeconds?: number;
  /** Every ref an answer may cite, resolved from the question's `acceptedEvidence` at build time. */
  readonly acceptedRefs: readonly string[];
}

/** One answer on the report: what the player wrote, and the pins they cited for it. */
export interface CitedAnswer {
  readonly value?: string;
  readonly cited?: readonly string[];
}

export interface Finding {
  readonly questionId: string;
  readonly verdict: ReportVerdict;
  readonly reason: FindingReason;
  /** The cited refs still on the board, in the order they were cited. */
  readonly cited: readonly string[];
  /** The cited refs that prove the answer: on the board and in the accepted evidence. */
  readonly supportedBy: readonly string[];
}

/** One question's finding, given the answer, what's cited for it, and what's on the board. */
export function gradeQuestion(
  question: GradableQuestion,
  answer: CitedAnswer | undefined,
  pins: readonly string[],
): Finding {
  const value = answer?.value?.trim() ?? "";
  const wanted = [...(answer?.cited ?? [])];
  // Picking a pinned item as the answer cites it: the pick is the evidence.
  if (question.type === "evidence-pick" && value !== "") wanted.push(value);
  const cited = unique(wanted.filter((ref) => pins.includes(ref)));
  const supportedBy = cited.filter((ref) => question.acceptedRefs.includes(ref));
  const base = { questionId: question.id, cited, supportedBy };

  if (value === "") return { ...base, verdict: "not-yet", reason: "unanswered" };
  if (!isCorrect(question, value)) return { ...base, verdict: "not-yet", reason: "incorrect" };
  if (supportedBy.length > 0) return { ...base, verdict: "supported", reason: "supported" };
  return {
    ...base,
    verdict: "needs-evidence",
    reason: cited.length > 0 ? "irrelevant" : "uncited",
  };
}

/**
 * Every question's finding, in the report's order. `pins` is the board: a citation only counts
 * while the pin it cites is still there.
 */
export function gradeReport(
  report: { readonly questions: readonly GradableQuestion[] },
  answers: Readonly<Record<string, CitedAnswer | undefined>>,
  pins: readonly string[],
): Finding[] {
  return report.questions.map((question) => gradeQuestion(question, answers[question.id], pins));
}

/** The report draft and the citations, joined into the answers the grader reads. */
export function reportAnswers(
  draft: Readonly<Record<string, string>>,
  citations: Readonly<Record<string, readonly string[]>>,
): Record<string, CitedAnswer> {
  const answers: Record<string, CitedAnswer> = {};
  for (const id of new Set([...Object.keys(draft), ...Object.keys(citations)])) {
    const value = draft[id];
    const cited = citations[id];
    answers[id] = { ...(value !== undefined && { value }), ...(cited && { cited }) };
  }
  return answers;
}

/** "n of m findings supported": never a number that can go down for asking for help. */
export function supportedCount(findings: readonly Finding[]): number {
  return findings.filter((finding) => finding.verdict === "supported").length;
}

/** Whether what the player wrote is the answer, by the question's kind. */
export function isCorrect(question: GradableQuestion, given: string): boolean {
  if (question.type === "timestamp") {
    const wanted = question.answerAt ?? parseAnswerTime(question.answer);
    const got = parseAnswerTime(given);
    if (wanted === undefined || got === undefined) return false;
    return Math.abs(got - wanted) <= (question.toleranceSeconds ?? 0) * 1000;
  }
  if (question.type === "evidence-pick") {
    return question.acceptedRefs.some((ref) => same(ref, given));
  }
  return same(question.answer, given);
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

const unique = (refs: readonly string[]): string[] =>
  refs.filter((ref, index) => refs.indexOf(ref) === index);

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
