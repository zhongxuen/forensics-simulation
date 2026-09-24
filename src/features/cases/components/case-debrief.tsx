"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CheckIcon } from "@/components/ui/icons";
import type { CaseReportSpec, RunnableCase } from "../run/case-definition";
import type { CaseRunAction, CaseRunState } from "../run/case-run";
import { caseProgress } from "../run/evaluate";
import { gradeReport, supportedCount, type ReportVerdict } from "../run/report";
import { SUMMARY_QUESTION } from "./case-report";
import { CaseText } from "./case-text";

interface CaseDebriefProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
}

/**
 * The debrief: what you did, the bonuses you found, how each report answer landed ("n of m
 * findings supported", never a number that can go down), what you learned and what the client can
 * fix. Never a score (99 §Banned engagement mechanics).
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

      {caseDef.report && <Findings report={caseDef.report} run={run} dispatch={dispatch} />}

      {caseDef.debrief && (
        <>
          <p className="mt-8 leading-7">
            <CaseText text={caseDef.debrief.summary} />
          </p>
          <section aria-labelledby="debrief-learned" className="mt-6">
            <h2 id="debrief-learned" className="text-sm font-semibold tracking-wide text-secondary">
              What you learned
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-7">
              {caseDef.debrief.whatYouLearned.map((line) => (
                <li key={line}>
                  <CaseText text={line} />
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="debrief-ethics" className="mt-6">
            <h2 id="debrief-ethics" className="text-sm font-semibold tracking-wide text-secondary">
              Why this was yours to look at
            </h2>
            <p className="mt-2 leading-7">
              <CaseText text={caseDef.debrief.ethicsNote} />
            </p>
          </section>
        </>
      )}

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

      {caseDef.debrief?.nextTease && (
        <p className="mt-6 leading-7 text-secondary italic">
          <CaseText text={caseDef.debrief.nextTease} />
        </p>
      )}

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

const VERDICT: Readonly<Record<ReportVerdict, { label: string; tone: BadgeTone; note: string }>> = {
  supported: {
    label: "Supported",
    tone: "success",
    note: "Right, and something on your board backs it up.",
  },
  "needs-evidence": {
    label: "Needs evidence",
    tone: "warning",
    note: "Right answer, but nothing you pinned points at it yet. Pin the record that shows it, then submit again.",
  },
  "not-yet": {
    label: "Not yet",
    tone: "neutral",
    note: "Not this one yet. Have another look at the evidence, and change it on the report.",
  },
};

interface FindingsProps {
  report: CaseReportSpec;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
}

/** Each report answer and how it landed, with what it means once it's right. */
function Findings({ report, run, dispatch }: FindingsProps) {
  const grades = gradeReport(report, run.reportDraft, run.pins);
  const supported = supportedCount(grades);
  const total = report.questions.length;
  return (
    <section aria-labelledby="debrief-findings" className="mt-8">
      <h2 id="debrief-findings" className="text-xl font-semibold">
        Your report: {supported} of {total} {total === 1 ? "finding" : "findings"} supported
      </h2>
      <ol className="mt-4 space-y-4">
        {report.questions.map((question, index) => {
          const grade = grades[index];
          if (!grade) return null;
          const verdict = VERDICT[grade.verdict];
          const answer = run.reportDraft[question.id];
          return (
            <li
              key={question.id}
              className="rounded-lg border border-subtle bg-surface-raised px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="leading-7 font-semibold">{question.ask}</p>
                <Badge tone={verdict.tone}>{verdict.label}</Badge>
              </div>
              <p className="mt-1 leading-7 text-secondary">
                You wrote: {answer ? <span className="text-primary">{answer}</span> : "nothing yet"}
              </p>
              <p className="mt-1 text-sm leading-6 text-secondary">{verdict.note}</p>
              {grade.verdict !== "not-yet" && (
                <p className="mt-2 leading-7">
                  <CaseText text={question.explain} />
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {supported < total && (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => dispatch({ type: "resume" })}>
            Back to the workspace to keep looking
          </Button>
        </div>
      )}
    </section>
  );
}
