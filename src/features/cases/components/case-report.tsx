"use client";

import { useId, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { MAX_DRAFT_LENGTH } from "@/lib/case-storage";
import { cx } from "@/lib/cx";
import type { CaseReportQuestion, RunnableCase } from "../run/case-definition";
import type { CaseRunAction, CaseRunState } from "../run/case-run";

/** The report draft key for the free text at the end of the report. */
export const SUMMARY_QUESTION = "summary";

interface CaseReportProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

/** Keyboard focus on a radio hidden inside its label shows on the label (as in the settings form). */
const LABEL_FOCUS_RING =
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring";

const FIELD = cx(
  "mt-2 w-full rounded-md border border-strong bg-surface-base px-3 py-2 leading-7 text-primary",
  FOCUS_RING,
);

/**
 * The report: the case's questions, each answered from what the player found, then a free summary
 * for the client. Answers are graded on the debrief — supported, needs evidence or not yet — against
 * what's pinned to the board, so the board is shown here too. Nothing is marked down: go back,
 * pin, change an answer and submit again as often as you like. A case with no questions (the
 * practice case) is the summary alone.
 */
export function CaseReport({ caseDef, run, dispatch, headingRef }: CaseReportProps) {
  const id = useId();
  const questions = caseDef.report?.questions ?? [];
  const draft = (questionId: string, text: string) => dispatch({ type: "draft", questionId, text });

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
          Answer each question from what you found. An answer counts as <em>supported</em> when
          something you pinned to the board backs it up, so the next person can check it without
          taking your word for it. You&apos;ll see how each one landed on the next screen, and you
          can come back and change them as often as you like.
        </p>
      ) : (
        <p className="mt-4 leading-7 text-secondary">
          Write a short summary for the client: what happened, and what they should fix.
        </p>
      )}

      {questions.length > 0 && (
        <>
          <section aria-labelledby={`${id}-board`} className="mt-8">
            <h2 id={`${id}-board`} className="text-sm font-semibold tracking-wide text-secondary">
              On your board
            </h2>
            {run.pins.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {run.pins.map((ref) => (
                  <li
                    key={ref}
                    className="rounded-md border border-subtle bg-surface-raised px-2 py-1 font-mono text-sm"
                  >
                    {ref}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 leading-7 text-secondary">
                Nothing is pinned yet, so no answer can point at evidence. Go back to the workspace
                and use <code className="font-mono">pin</code> after a command that shows a record.
              </p>
            )}
          </section>

          <ol className="mt-8 space-y-8">
            {questions.map((question, index) => (
              <li key={question.id}>
                <QuestionField
                  question={question}
                  number={index + 1}
                  value={run.reportDraft[question.id] ?? ""}
                  pins={run.pins}
                  onChange={(text) => draft(question.id, text)}
                />
              </li>
            ))}
          </ol>
        </>
      )}

      <label htmlFor={`${id}-summary`} className="mt-8 block font-semibold">
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
  pins: readonly string[];
  onChange: (text: string) => void;
}

/** One question, with the control its kind of answer needs. */
function QuestionField({ question, number, value, pins, onChange }: QuestionFieldProps) {
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
          {pins.map((ref) => (
            <option key={ref} value={ref}>
              {ref}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const help =
    question.type === "timestamp"
      ? "Write the time with its zone, the way the tools print it, like 2026-01-31T08:05:00Z. Z means UTC."
      : undefined;
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
        className={cx(FIELD, question.type === "timestamp" && "font-mono")}
      />
    </div>
  );
}
