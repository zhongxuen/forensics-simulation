"use client";

import { useId, useMemo, type RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { MAX_DRAFT_LENGTH } from "@/lib/case-storage";
import { cx } from "@/lib/cx";
import { boardCards, type BoardCard, type CardSource } from "@/features/case-board";
import type { EvidenceSet } from "@/sim/types";
import type { CaseReportQuestion, RunnableCase } from "../../run/case-definition";
import type { CaseRunAction, CaseRunState } from "../../run/case-run";

/** The report draft key for the free text at the end of the report. */
export const SUMMARY_QUESTION = "summary";

interface ReportScreenProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
  /** The case's evidence, to name each pin in the pickers. Null for a case with none. */
  evidence: EvidenceSet | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

/** Keyboard focus on an input hidden inside its label shows on the label (as in the settings form). */
const LABEL_FOCUS_RING =
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring";

const FIELD = cx(
  "mt-2 w-full rounded-md border border-strong bg-surface-base px-3 py-2 leading-7 text-primary",
  FOCUS_RING,
);

/**
 * The report (docs/plan/10-case-board-report-custody.md §Report, UIUX.md §2.7): the case's
 * questions, numbered, each with the control its kind of answer needs and a **Supporting
 * evidence** picker that shows what's on the board as pin cards, then a free summary for the
 * client. A sticky bar keeps Submit in reach, with how far through the report the player is ("2 of
 * 3 answered, 1 with evidence"): what's filled in, never whether it's right. Answers are graded on
 * the debrief: an answer is supported only when something it cites proves it. Nothing is marked
 * down: come back, pin, cite, change an answer and submit again as often as you like. A case with
 * no questions (the practice case) is the summary alone.
 */
export function ReportScreen({ caseDef, run, dispatch, evidence, headingRef }: ReportScreenProps) {
  const id = useId();
  const questions = caseDef.report?.questions ?? [];
  const draft = (questionId: string, text: string) => dispatch({ type: "draft", questionId, text });
  const cards = useMemo(
    () => boardCards(run.pins, run.events, evidence, run.pinNotes),
    [run.pins, run.events, evidence, run.pinNotes],
  );
  const progress = reportProgress(questions, run.reportDraft, run.citations, cards);

  return (
    <article aria-labelledby={`${id}-title`} className="mx-auto max-w-3xl">
      <p className="type-eyebrow">Report</p>
      <h1
        id={`${id}-title`}
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 type-page-title outline-none"
      >
        Your report for {caseDef.client.org}
      </h1>
      {questions.length > 0 ? (
        <p className="mt-4 max-w-prose type-body text-secondary">
          Answer each question from what you found, then tick the pinned evidence that shows it. An
          answer counts as <em>supported</em> when something you cite proves it, so the next person
          can check it without taking your word for it. You&apos;ll see how each one landed on the
          next screen, and you can come back, change it and submit again as often as you like.
        </p>
      ) : (
        <p className="mt-4 max-w-prose type-body text-secondary">
          Write a short summary for the client: what happened, and what they should fix.
        </p>
      )}

      {questions.length > 0 && cards.length === 0 && (
        <p className="mt-6 rounded-lg border border-subtle bg-surface-raised px-4 py-3 type-body text-secondary">
          Nothing is pinned yet, so no answer can point at evidence. Go back to the workspace and
          use <code className="font-mono">pin</code> after a command that shows a record.
        </p>
      )}

      {questions.length > 0 && (
        <ol className="mt-8 space-y-6">
          {questions.map((question, index) => {
            const value = run.reportDraft[question.id] ?? "";
            const cited = run.citations[question.id] ?? [];
            return (
              <li
                key={question.id}
                className="rounded-xl border border-subtle bg-surface-raised p-4 sm:p-5"
              >
                <div className="flex gap-3 sm:gap-4">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-strong type-small font-semibold text-secondary"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-4">
                    <QuestionField
                      question={question}
                      value={value}
                      cards={cards}
                      onChange={(text) => draft(question.id, text)}
                    />
                    <EvidencePicker
                      cards={cards}
                      cited={cited}
                      onChange={(refs) => dispatch({ type: "cite", questionId: question.id, refs })}
                    />
                    <p className="type-small text-muted">
                      {questionState(value, citedOnBoard(cited, cards))}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <label htmlFor={`${id}-summary`} className="mt-10 block type-body font-semibold">
        {questions.length > 0 ? "Anything else for the client (optional)" : "Your summary"}
      </label>
      <textarea
        id={`${id}-summary`}
        value={run.reportDraft[SUMMARY_QUESTION] ?? ""}
        maxLength={MAX_DRAFT_LENGTH}
        onChange={(event) => draft(SUMMARY_QUESTION, event.target.value)}
        rows={questions.length > 0 ? 4 : 8}
        className={FIELD}
      />

      {/* Submit stays in reach however far down the report the player has scrolled. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-subtle bg-surface-base/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:mx-0 sm:rounded-t-lg sm:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="primary" onClick={() => dispatch({ type: "submitReport" })}>
            Submit report
          </Button>
          <Button variant="secondary" onClick={() => dispatch({ type: "resume" })}>
            Back to the workspace
          </Button>
          {questions.length > 0 && (
            <p role="status" className="type-small text-secondary sm:ml-2">
              {progressLine(progress)}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export interface ReportProgress {
  readonly answered: number;
  readonly withEvidence: number;
  readonly total: number;
}

/**
 * How far through the report the player is: the questions with an answer written, and how many of
 * those cite something still on the board. It counts what's filled in, never whether it's right:
 * that's the debrief's job, after Submit.
 */
export function reportProgress(
  questions: readonly Pick<CaseReportQuestion, "id">[],
  draft: Readonly<Record<string, string>>,
  citations: Readonly<Record<string, readonly string[]>>,
  cards: readonly Pick<BoardCard, "ref">[],
): ReportProgress {
  let answered = 0;
  let withEvidence = 0;
  for (const question of questions) {
    if (!(draft[question.id] ?? "").trim()) continue;
    answered += 1;
    if (citedOnBoard(citations[question.id] ?? [], cards) > 0) withEvidence += 1;
  }
  return { answered, withEvidence, total: questions.length };
}

/** "2 of 3 answered, 1 with evidence". */
export function progressLine({ answered, withEvidence, total }: ReportProgress): string {
  return `${answered} of ${total} answered, ${withEvidence} with evidence`;
}

/** How many of an answer's citations are still on the board: a removed pin can't be cited. */
function citedOnBoard(cited: readonly string[], cards: readonly Pick<BoardCard, "ref">[]): number {
  return cited.filter((ref) => cards.some((card) => card.ref === ref)).length;
}

/** One question's line under its picker: what's filled in so far, never whether it's right. */
function questionState(value: string, cited: number): string {
  const evidence = cited === 0 ? "nothing cited yet" : `${cited} cited`;
  return `${value.trim() ? "Answered" : "Not answered yet"} · ${evidence}`;
}

interface QuestionFieldProps {
  question: CaseReportQuestion;
  value: string;
  cards: readonly BoardCard[];
  onChange: (text: string) => void;
}

/** One question, with the control its kind of answer needs. */
function QuestionField({ question, value, cards, onChange }: QuestionFieldProps) {
  const id = useId();
  const label = question.ask;
  const labelClass = "block pt-0.5 type-body font-semibold text-pretty";

  if (question.type === "choice" && question.choices) {
    return (
      <fieldset>
        <legend className={labelClass}>{label}</legend>
        <div className="mt-3 space-y-2">
          {question.choices.map((choice) => (
            <label
              key={choice}
              className={cx(
                "flex cursor-pointer gap-3 rounded-lg border border-subtle bg-surface-overlay px-4 py-3 hover:border-strong",
                "has-checked:border-accent has-checked:bg-accent-subtle",
                LABEL_FOCUS_RING,
              )}
            >
              <input
                type="radio"
                name={id}
                value={choice}
                checked={value === choice}
                onChange={() => onChange(choice)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="mt-1.5 grid size-4.5 shrink-0 place-items-center rounded-full border-2 border-strong peer-checked:border-accent peer-checked:after:size-2 peer-checked:after:rounded-full peer-checked:after:bg-accent"
              />
              <span className="leading-7">{choice}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.type === "evidence-pick") {
    return (
      <div>
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={FIELD}
        >
          <option value="">Choose something on your board</option>
          {cards.map((card) => (
            <option key={card.ref} value={card.ref}>
              {card.title} ({card.ref})
            </option>
          ))}
        </select>
      </div>
    );
  }

  const timestamp = question.type === "timestamp";
  const help = timestamp
    ? "Write the time with its zone, the way the tools print it, like 2026-01-31T08:05:00Z. Z means UTC. Or use a time from your board."
    : question.type === "account"
      ? "The account name, the way the evidence writes it."
      : question.type === "host"
        ? "The machine's name, the way the evidence writes it."
        : undefined;
  const times = timestamp ? cards.filter((card) => card.utc !== undefined) : [];
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {help && (
        <p id={`${id}-help`} className="mt-1 type-small text-secondary">
          {help}
        </p>
      )}
      <input
        id={id}
        type="text"
        value={value}
        maxLength={MAX_DRAFT_LENGTH}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        {...(help && { "aria-describedby": `${id}-help` })}
        className={cx(FIELD, timestamp && "font-mono")}
      />
      {times.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Times on your board">
          {times.map((card) => (
            <Button
              key={card.ref}
              variant="ghost"
              size="sm"
              onClick={() => onChange(card.utc ?? "")}
            >
              Use {card.utc}
              <span className="sr-only">
                , the {card.timeLabel?.toLowerCase()} time of {card.title}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A pin's source, as the Case Board names it. */
const SOURCE_LABEL: Readonly<Record<CardSource, string>> = {
  disk: "Disk",
  memory: "Memory",
  log: "Log",
};

interface EvidencePickerProps {
  cards: readonly BoardCard[];
  cited: readonly string[];
  onChange: (refs: string[]) => void;
}

/**
 * The pins an answer cites, as cards like the Board's: source, what it is, its ref and note. Each
 * card is a checkbox (a native one, visually hidden inside its label), so Tab reaches each pin and
 * Space ticks it. It lists what's on the board and nothing else.
 */
function EvidencePicker({ cards, cited, onChange }: EvidencePickerProps) {
  const toggle = (ref: string, on: boolean) =>
    onChange(
      on
        ? [...cited.filter((item) => cards.some((card) => card.ref === item)), ref]
        : cited.filter((item) => item !== ref),
    );
  return (
    <fieldset>
      <legend className="type-eyebrow">Supporting evidence</legend>
      {cards.length === 0 ? (
        <p className="mt-2 type-small text-secondary">
          Pinned items show up here to cite. You haven&apos;t pinned anything yet.
        </p>
      ) : (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {cards.map((card) => (
            <li key={card.ref} className="min-w-0">
              <label
                className={cx(
                  "flex h-full cursor-pointer items-start gap-3 rounded-lg border border-subtle bg-surface-base px-3 py-2.5 hover:border-strong",
                  // A tint under this much small text would cost it contrast: a ticked card gets
                  // an amber edge instead.
                  "has-checked:border-accent has-checked:shadow-[inset_0_0_0_1px_var(--accent)]",
                  LABEL_FOCUS_RING,
                )}
              >
                <input
                  type="checkbox"
                  checked={cited.includes(card.ref)}
                  onChange={(event) => toggle(card.ref, event.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-sm border-2 border-strong text-surface-base peer-checked:border-accent peer-checked:bg-accent"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cx("size-3", !cited.includes(card.ref) && "invisible")}
                  >
                    <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge>{SOURCE_LABEL[card.source]}</Badge>
                    <Badge tone="evidence-tag" className="min-w-0">
                      {card.ref}
                    </Badge>
                  </span>
                  <span className="mt-1.5 block type-data font-semibold break-all">
                    {card.title}
                  </span>
                  {card.utc && (
                    <span className="block type-small text-secondary">
                      {card.timeLabel} <span className="type-data">{card.utc}</span>
                    </span>
                  )}
                  {card.note && (
                    <span className="mt-0.5 block type-small text-secondary">{card.note}</span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
