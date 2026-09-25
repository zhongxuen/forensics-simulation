"use client";

import Link from "next/link";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { useSavedRuns } from "@/hooks/use-saved-runs";
import { cx } from "@/lib/cx";
import { nextStepFor } from "@/lib/next-step-from-runs";
import { caseState, type CaseState, type CaseSummary } from "../run/case-state";

/**
 * The case list on /cases (UIUX.md §2.3): the chapter's cases in order, each with its number, how
 * long it takes, where you are in it (from the run saved in this browser) and a button that says
 * what happens next. The practice case sits in its own labelled row after the chapter, and a case
 * that isn't released yet stays on the list, quiet, with no button.
 *
 * One button is the primary one: the case the sidebar's next step points at (the case in
 * progress, or the first one not started). Before the page can read storage, that's Case 1.
 */
export function CaseList({ summaries }: { summaries: readonly CaseSummary[] }) {
  const runs = useSavedRuns("/cases");
  const chapter = summaries.filter((summary) => summary.number !== undefined);
  const practice = summaries.filter((summary) => summary.number === undefined);

  const released = chapter.flatMap(({ id, number, title, objectives, released: out }) =>
    number !== undefined && out ? [{ id, number, title, objectives }] : [],
  );
  const next = nextStepFor(runs ?? {}, released).href;
  const stateOf = (summary: CaseSummary): CaseState =>
    caseState(summary, runs && Object.hasOwn(runs, summary.id) ? runs[summary.id] : undefined);

  return (
    <div className="space-y-12">
      <section aria-labelledby="chapter-cases" className="space-y-4">
        <h2 id="chapter-cases" className="type-section-title">
          The cases
        </h2>
        <ol className="space-y-4">
          {chapter.map((summary) => (
            <li key={summary.id}>
              <CaseCard
                summary={summary}
                state={stateOf(summary)}
                primary={next === `/cases/${summary.id}`}
              />
            </li>
          ))}
        </ol>
      </section>

      {practice.length > 0 && (
        <section aria-labelledby="practice-cases" className="space-y-4">
          <div>
            <h2 id="practice-cases" className="type-section-title">
              Practice
            </h2>
            <p className="mt-1 max-w-prose type-small text-secondary">
              A short warm-up in the same workspace, outside the story. Play it before Case 1 or any
              time after: it doesn&apos;t change the chapter.
            </p>
          </div>
          <ul className="space-y-4">
            {practice.map((summary) => (
              <li key={summary.id}>
                <CaseCard summary={summary} state={stateOf(summary)} primary={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

interface CaseCardProps {
  summary: CaseSummary;
  state: CaseState;
  /** This case is the next step: its button is the page's one primary button. */
  primary: boolean;
}

function CaseCard({ summary, state, primary }: CaseCardProps) {
  const titleId = useId();
  const eyebrow = [
    summary.number === undefined ? "Practice" : `Case ${summary.number}`,
    summary.minutes === undefined ? undefined : `About ${summary.minutes} minutes`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!summary.released) {
    return (
      <article
        aria-labelledby={titleId}
        className="rounded-xl border border-dashed border-subtle p-5 text-secondary"
      >
        <p className="type-eyebrow">{eyebrow}</p>
        <h3 id={titleId} className="mt-1 text-lg font-semibold">
          {summary.title}
        </h3>
        <p className="mt-2 type-small">Still being written. It arrives in a later update.</p>
      </article>
    );
  }

  return (
    <article
      aria-labelledby={titleId}
      className={cx(
        "flex flex-col gap-4 rounded-xl border bg-surface-raised p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        primary ? "border-accent/60" : "border-subtle",
      )}
    >
      <div className="max-w-prose min-w-0">
        <p className="type-eyebrow">{eyebrow}</p>
        <h3 id={titleId} className="mt-1 text-lg font-semibold text-primary">
          {summary.title}
        </h3>
        <p className="mt-2 type-body text-secondary">{summary.summary}</p>
        <p className="mt-3">
          <StateBadge state={state} />
        </p>
      </div>
      <Link
        href={`/cases/${summary.id}`}
        aria-describedby={titleId}
        className={cx(
          buttonClassName({ variant: primary ? "primary" : "secondary" }),
          "self-start sm:self-auto",
        )}
      >
        <span>
          {actionLabel(summary, state)}
          {state.kind !== "not-started" && (
            // Several cases can say "Continue": the name says which one.
            <span className="sr-only">
              {state.kind === "closed" ? " for " : " "}
              {summary.number === undefined ? "the practice case" : `Case ${summary.number}`}
            </span>
          )}
        </span>
        <ArrowRightIcon aria-hidden="true" />
      </Link>
    </article>
  );
}

/** The button says what happens: "Open Case 1", "Continue", "Read the debrief". */
function actionLabel(summary: CaseSummary, state: CaseState): string {
  switch (state.kind) {
    case "in-progress":
      return "Continue";
    case "closed":
      return "Read the debrief";
    case "not-started":
      return summary.number === undefined
        ? "Open the practice case"
        : `Open Case ${summary.number}`;
  }
}

function StateBadge({ state }: { state: CaseState }) {
  switch (state.kind) {
    case "not-started":
      return <Badge tone="neutral">Not started</Badge>;
    case "in-progress":
      return (
        <Badge tone="accent">
          In progress · {state.done} of {state.total} objectives
        </Badge>
      );
    case "closed":
      return (
        <Badge tone="success">
          {state.supported === undefined
            ? "Closed"
            : `Closed · ${state.supported} of ${state.total} findings supported`}
        </Badge>
      );
  }
}
