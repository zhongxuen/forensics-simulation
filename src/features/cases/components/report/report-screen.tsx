"use client";

import { useId, useMemo, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { MAX_DRAFT_LENGTH } from "@/lib/case-storage";
import { cx } from "@/lib/cx";
import { boardCards, type BoardCard } from "@/features/case-board";
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
 * The report (docs/plan/10-case-board-report-custody.md §Report): the case's questions, each with
 * the control its kind of answer needs and a **Supporting evidence** picker that lists what's on
 * the board, then a free summary for the client. Answers are graded on the debrief: an answer is
 * supported only when something it cites proves it. Nothing is marked down: come back, pin, cite,
 * change an answer and submit again as often as you like. A case with no questions (the practice
 * case) is the summary alone.
 */
export function ReportScreen({ caseDef, run, dispatch, evidence, headingRef }: ReportScreenProps) {
  const id = useId();
  const questions = caseDef.report?.questions ?? [];
  const draft = (questionId: string, text: string) => dispatch({ type: "draft", questionId, text });
  const cards = useMemo(
    () => boardCards(run.pins, run.events, evidence, run.pinNotes),
    [run.pins, run.events, evidence, run.pinNotes],
  );

  return (
    <article aria-labelledby={`${id}-title`} className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-accent">Report</p>
      <h1
        id={`${id}-title`}
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-3xl font-semibold tracking-tight text-balance outline-none"
      >
        Your report for {caseDef.client.org}
      </h1>
      {questions.length > 0 ? (
        <p className="mt-4 leading-7 text-secondary">
          Answer each question from what you found, then tick the pinned evidence that shows it. An
          answer counts as <em>supported</em> when something you cite proves it, so the next person
          can check it without taking your word for it. You&apos;ll see how each one landed on the
          next screen, and you can come back, change it and submit again as often as you like.
        </p>
      ) : (
        <p className="mt-4 leading-7 text-secondary">
          Write a short summary for the client: what happened, and what they should fix.
        </p>
      )}

      {questions.length > 0 && cards.length === 0 && (
        <p className="mt-6 rounded-lg border border-subtle bg-surface-raised px-4 py-3 leading-7 text-secondary">
          Nothing is pinned yet, so no answer can point at evidence. Go back to the workspace and
          use <code className="font-mono">pin</code> after a command that shows a record.
        </p>
      )}

      {questions.length > 0 && (
        <ol className="mt-8 space-y-10">
          {questions.map((question, index) => (
            <li key={question.id} className="space-y-4">
              <QuestionField
                question={question}
                number={index + 1}
                value={run.reportDraft[question.id] ?? ""}
                cards={cards}
                onChange={(text) => draft(question.id, text)}
              />
              <EvidencePicker
                cards={cards}
                cited={run.citations[question.id] ?? []}
                onChange={(refs) => dispatch({ type: "cite", questionId: question.id, refs })}
              />
            </li>
          ))}
        </ol>
      )}

      <label htmlFor={`${id}-summary`} className="mt-10 block font-semibold">
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

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => dispatch({ type: "submitReport" })}>
          Submit report
        </Button>
        <Button variant="secondary" onClick={() => dispatch({ type: "resume" })}>
          Back to the workspace
        </Button>
      </div>
    </article>
  );
}

interface QuestionFieldProps {
  question: CaseReportQuestion;
  number: number;
  value: string;
  cards: readonly BoardCard[];
  onChange: (text: string) => void;
}

/** One question, with the control its kind of answer needs. */
function QuestionField({ question, number, value, cards, onChange }: QuestionFieldProps) {
  const id = useId();
  const label = `${number}. ${question.ask}`;

  if (question.type === "choice" && question.choices) {
    return (
      <fieldset>
        <legend className="leading-7 font-semibold">{label}</legend>
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
        <label htmlFor={id} className="block leading-7 font-semibold">
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
      <label htmlFor={id} className="block leading-7 font-semibold">
        {label}
      </label>
      {help && (
        <p id={`${id}-help`} className="mt-1 text-sm leading-6 text-secondary">
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

interface EvidencePickerProps {
  cards: readonly BoardCard[];
  cited: readonly string[];
  onChange: (refs: string[]) => void;
}

/** The pins an answer cites. It lists what's on the board and nothing else. */
function EvidencePicker({ cards, cited, onChange }: EvidencePickerProps) {
  const toggle = (ref: string, on: boolean) =>
    onChange(
      on
        ? [...cited.filter((item) => cards.some((card) => card.ref === item)), ref]
        : cited.filter((item) => item !== ref),
    );
  return (
    <fieldset className="rounded-lg border border-subtle px-4 pt-2 pb-3">
      <legend className="px-1 text-sm font-semibold">Supporting evidence</legend>
      {cards.length === 0 ? (
        <p className="text-sm leading-6 text-secondary">
          Pinned items show up here to cite. You haven&apos;t pinned anything yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {cards.map((card) => (
            <li key={card.ref}>
              <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-surface-overlay">
                <input
                  type="checkbox"
                  checked={cited.includes(card.ref)}
                  onChange={(event) => toggle(card.ref, event.target.checked)}
                  className="mt-1.5 size-4 shrink-0 accent-accent"
                />
                <span className="min-w-0 leading-7">
                  <span className="font-mono text-sm break-all">{card.title}</span>
                  <span className="block text-xs text-muted">
                    {card.ref}
                    {card.note && ` · ${card.note}`}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
