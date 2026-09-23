"use client";

import { useId, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { MAX_DRAFT_LENGTH } from "@/lib/case-storage";
import { cx } from "@/lib/cx";
import type { RunnableCase } from "../run/case-definition";
import type { CaseRunAction, CaseRunState } from "../run/case-run";

/** The report draft key the placeholder writes to. File 10's questions get their own ids. */
export const SUMMARY_QUESTION = "summary";

interface CaseReportProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

/**
 * The report, as a placeholder until file 10 builds the real one (questions whose answers point
 * at evidence, each supported, needing evidence or not yet). For now: a free summary for the
 * client, kept with the case, and Submit report on to the debrief.
 */
export function CaseReport({ caseDef, run, dispatch, headingRef }: CaseReportProps) {
  const summaryId = useId();
  return (
    <article aria-labelledby={`${summaryId}-title`} className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-accent">Report</p>
      <h1
        id={`${summaryId}-title`}
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-3xl font-semibold tracking-tight text-balance outline-none"
      >
        Your report for {caseDef.client.org}
      </h1>
      <p className="mt-4 leading-7 text-secondary">
        The full report arrives in a later update: each answer will point at the evidence that backs
        it up. For now, write a short summary for the client: what happened, and what they should
        fix.
      </p>

      <label htmlFor={summaryId} className="mt-8 block font-semibold">
        Your summary
      </label>
      <textarea
        id={summaryId}
        value={run.reportDraft[SUMMARY_QUESTION] ?? ""}
        maxLength={MAX_DRAFT_LENGTH}
        onChange={(event) =>
          dispatch({ type: "draft", questionId: SUMMARY_QUESTION, text: event.target.value })
        }
        rows={8}
        className={cx(
          "mt-2 w-full rounded-md border border-strong bg-surface-base px-3 py-2 leading-7 text-primary",
          FOCUS_RING,
        )}
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
