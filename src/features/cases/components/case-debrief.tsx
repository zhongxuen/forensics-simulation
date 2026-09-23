"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CheckIcon } from "@/components/ui/icons";
import type { RunnableCase } from "../run/case-definition";
import type { CaseRunAction, CaseRunState } from "../run/case-run";
import { caseProgress } from "../run/evaluate";
import { SUMMARY_QUESTION } from "./case-report";
import { CaseText } from "./case-text";

interface CaseDebriefProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
}

/**
 * The debrief: what you did, the bonuses you found, and what the client can fix. Never a score
 * (99 §Banned engagement mechanics). File 10 adds "n of m findings supported" from the report.
 */
export function CaseDebrief({ caseDef, run, dispatch }: CaseDebriefProps) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const { done, total } = caseProgress(caseDef, run.completed);
  const extras = caseDef.objectives.filter(
    (objective) => (objective.optional || objective.hidden) && run.completed.includes(objective.id),
  );
  const summary = run.reportDraft[SUMMARY_QUESTION];

  return (
    <article aria-labelledby="case-debrief-title" className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-accent">Debrief</p>
      <h1
        id="case-debrief-title"
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-3xl font-semibold tracking-tight text-balance outline-none"
      >
        Case closed: {caseDef.title}
      </h1>
      <p className="mt-4 text-lg leading-8 text-secondary">
        {done} of {total} objectives done.
        {extras.length > 0 &&
          ` You found ${extras.length === 1 ? "1 bonus" : `${extras.length} bonuses`} too.`}
      </p>

      <ul className="mt-6 space-y-3">
        {caseDef.objectives
          .filter((objective) => run.completed.includes(objective.id))
          .map((objective) => (
            <li key={objective.id} className="flex gap-3 leading-7">
              <CheckIcon aria-hidden="true" className="mt-1.5 size-4 shrink-0 text-reward" />
              <span>
                {objective.name && <span className="font-semibold">{objective.name}: </span>}
                <CaseText text={objective.success} />
              </span>
            </li>
          ))}
      </ul>

      <section
        aria-labelledby="debrief-fix"
        className="mt-8 rounded-lg border border-l-4 border-subtle border-l-status-success bg-surface-raised px-4 py-3"
      >
        <h2 id="debrief-fix" className="text-sm font-semibold text-status-success">
          What {caseDef.client.org} can fix
        </h2>
        <p className="mt-1.5 leading-7 text-primary">
          <CaseText text={caseDef.defensiveTakeaway} />
        </p>
      </section>

      {summary && (
        <section aria-labelledby="debrief-summary" className="mt-6">
          <h2 id="debrief-summary" className="text-sm font-semibold tracking-wide text-secondary">
            Your summary
          </h2>
          <p className="mt-2 leading-7 whitespace-pre-wrap">{summary}</p>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/cases" variant="primary">
          Back to your cases
        </ButtonLink>
        <Button variant="secondary" onClick={() => dispatch({ type: "resume" })}>
          Back to the workspace
        </Button>
        <Button variant="danger" onClick={() => setConfirmRestart(true)}>
          Start the case again
        </Button>
      </div>

      <Dialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        title="Start this case again?"
        description="Your commands, notes, pins and ticks for this case will be cleared, and you'll go back to the briefing."
        size="sm"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmRestart(false)}>
              Keep this run
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmRestart(false);
                dispatch({ type: "restart" });
              }}
            >
              Start the case again
            </Button>
          </>
        }
      />
    </article>
  );
}
