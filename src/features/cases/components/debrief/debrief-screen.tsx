"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { CharacterMessage } from "@/components/ui/character-message";
import { Dialog } from "@/components/ui/dialog";
import { CheckIcon, DownloadIcon } from "@/components/ui/icons";
import { getCastMember } from "@/content/cast";
import {
  MentorReviewCard,
  type MentorSession,
  type MentorTranscript,
  type ReviewCustodyFacts,
  type ReviewFacts,
  type ReviewObjectiveFact,
} from "@/features/mentor";
import { formatInstant, listTools } from "@/sim";
import type { EvidenceSet } from "@/sim/types";
import { custodyLog, custodyText, isAnalysis, type CustodyEntry } from "../../custody";
import {
  gradeReport,
  reportAnswers,
  supportedCount,
  type Finding,
  type FindingReason,
} from "../../grading";
import type { CaseReportQuestion, CaseReportSpec, RunnableCase } from "../../run/case-definition";
import type { CaseRunAction, CaseRunState } from "../../run/case-run";
import { caseProgress } from "../../run/evaluate";
import { CaseText } from "../case-text";
import { SUMMARY_QUESTION } from "../report/report-screen";
import { CustodyList } from "./custody-list";

interface DebriefScreenProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
  /** The case's evidence, for the handover lines on the custody record. */
  evidence: EvidenceSet | null;
  /**
   * Noor, for "Looking back with Noor" (docs/plan/14-mentor.md §Spec). The mentor is an
   * enhancement, never a dependency: without one the debrief is exactly as it was.
   */
  mentor?: MentorSession;
  /** Every line the player typed this attempt, for the review's run facts. */
  commandLines?: readonly string[];
  /**
   * The attempt's terminal activity, capped with the review's limits. It is the only player text
   * that ever leaves the browser, and only when they ask Noor to look back.
   */
  transcript?: MentorTranscript;
}

/**
 * The debrief: what you did, the bonuses you found, how each report answer landed ("n of m
 * findings supported", never a number that can go down, with each answer's meaning shown once
 * it's supported), what you learned, what the client can fix, and the chain of custody in full,
 * ready to download. Never a score (99 §Banned engagement mechanics). The report can be changed
 * and submitted again from here as often as the player likes.
 */
export function DebriefScreen({
  caseDef,
  run,
  dispatch,
  evidence,
  mentor,
  commandLines = [],
  transcript = [],
}: DebriefScreenProps) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const { done, total } = caseProgress(caseDef, run.completed);
  const extras = caseDef.objectives.filter(
    (objective) => (objective.optional || objective.hidden) && run.completed.includes(objective.id),
  );
  const summary = run.reportDraft[SUMMARY_QUESTION];
  const changeReport = () => dispatch({ type: "report" });

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

      {caseDef.report && caseDef.report.questions.length > 0 && (
        <Findings report={caseDef.report} run={run} onChangeReport={changeReport} />
      )}

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

      {mentor && (
        <div className="mt-8">
          <LookingBack
            caseDef={caseDef}
            run={run}
            mentor={mentor}
            commandLines={commandLines}
            transcript={transcript}
          />
        </div>
      )}

      <Custody caseDef={caseDef} run={run} evidence={evidence} />

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

/** Every command the workstation has, so a typo never lists as a command the player used. */
const KNOWN_COMMANDS: readonly string[] = listTools().map((tool) => tool.name);

/**
 * The chain of custody as the mentor may see it (docs/plan/14-mentor.md §Spec): each entry's
 * **kind**, in order, plus whether a hash came before anything opened the evidence and whether an
 * original was ever read around its write-blocker. No digest, path, record number or ref goes with
 * it — those are evidence, and the mentor holds no evidence.
 */
export function custodyFacts(log: readonly CustodyEntry[]): ReviewCustodyFacts {
  return {
    order: log.map((entry) => entry.kind),
    hashedFirst: log.some(
      (entry, index) =>
        entry.kind === "hashed" &&
        entry.verified !== false &&
        !log.slice(0, index).some(isAnalysis),
    ),
    readAroundBlocker: log.some((entry) => entry.kind === "original-read" && !entry.blocker),
  };
}

/** Reset machine presses this attempt: the run's log records each one, so a replay counts them. */
function resetCount(log: CaseRunState["log"]): number {
  return log.filter((entry) => "reset" in entry).length;
}

/**
 * "Looking back with Noor" (docs/plan/14-mentor.md §Spec). The player asks for it — their commands
 * only ever leave the browser when they ask the mentor for something — and the review is held with
 * the attempt, so coming back to the debrief never asks the model again.
 *
 * What travels is ids, counts, the capped transcript and the **shape** of the chain of custody.
 * Not the report's answers, and not which evidence supports them: the player can go straight back
 * and change their report from this screen, so an answer given here would still be an answer given.
 */
function LookingBack({
  caseDef,
  run,
  mentor,
  commandLines,
  transcript,
}: {
  caseDef: RunnableCase;
  run: CaseRunState;
  mentor: MentorSession;
  commandLines: readonly string[];
  transcript: MentorTranscript;
}) {
  const facts = useMemo((): ReviewFacts => {
    const log = custodyLog(run.events, run.marks);
    const questions = caseDef.report?.questions ?? [];
    const findings =
      questions.length === 0
        ? null
        : {
            supported: supportedCount(
              gradeReport({ questions }, reportAnswers(run.reportDraft, run.citations), run.pins),
            ),
            total: questions.length,
          };
    return {
      caseTitle: caseDef.title,
      objectives: caseDef.objectives.map((objective): ReviewObjectiveFact => ({
        id: objective.id,
        description: objective.description,
        ...(objective.name !== undefined && { name: objective.name }),
        kind: objective.hidden ? "secret" : objective.optional ? "bonus" : "main",
        done: run.completed.includes(objective.id),
        hintsOpened: run.hintsShown[objective.id] ?? 0,
      })),
      // The run's own clock isn't kept, so the time is left unknown rather than guessed at.
      minutes: null,
      commandLines,
      knownCommands: KNOWN_COMMANDS,
      pinCount: run.pins.length,
      custody: custodyFacts(log),
      findings,
      resets: resetCount(run.log),
      lessonIds: (caseDef.lessons ?? []).map((lesson) => lesson.id),
    };
  }, [caseDef, run, commandLines]);

  const lessonTitle = (id: string) =>
    (caseDef.lessons ?? []).find((lesson) => lesson.id === id)?.title;

  return (
    <MentorReviewCard
      state={mentor.state.review}
      facts={facts}
      lessonTitle={lessonTitle}
      onRequest={() => mentor.requestReview(facts, transcript)}
    />
  );
}

const BADGE: Readonly<Record<Finding["verdict"], { label: string; tone: BadgeTone }>> = {
  supported: { label: "Supported", tone: "success" },
  "needs-evidence": { label: "Needs evidence", tone: "warning" },
  "not-yet": { label: "Not yet", tone: "neutral" },
};

const NEEDS_EVIDENCE = "That's right. Now show how you know: cite a pinned item that proves it.";

/**
 * What to do next, by why the finding landed where it did. A "not yet" never gives the answer
 * away, and never shows the question's `explain`: that's for once the answer is supported.
 */
function nextStep(reason: FindingReason, question: CaseReportQuestion): string {
  switch (reason) {
    case "supported":
      return "Right, and what you cited proves it.";
    case "uncited":
      return NEEDS_EVIDENCE;
    case "irrelevant":
      return `${NEEDS_EVIDENCE} What you cited doesn't show this one.`;
    case "unanswered":
      return "Nothing written for this one yet. Answer it on the report, then submit again.";
    case "incorrect":
      switch (question.type) {
        case "timestamp":
          return "Not this time yet. Check the time on the record you pinned, and its zone: Z means UTC.";
        case "evidence-pick":
          return "That item doesn't show it yet. Look for the record that does, pin it, and pick it.";
        case "account":
        case "host":
          return "Not this name yet. Check how the evidence itself writes it.";
        case "choice":
          return "Not this one yet. Have another look at the evidence, then change it on the report.";
      }
  }
}

interface ChoiceFeedbackProps {
  question: CaseReportQuestion;
  answer: string | undefined;
  reason: FindingReason;
}

/**
 * A choice beat's consequence (docs/plan/99-reference.md, rule 6): when the choice picked has
 * feedback in the case file, the character says why it isn't the one, above the usual next step.
 * No fail screen: Change your report offers the choice again.
 */
function ChoiceFeedback({ question, answer, reason }: ChoiceFeedbackProps) {
  if (reason !== "incorrect" || answer === undefined) return null;
  const picked = answer.trim().toLowerCase();
  const item = question.feedback?.find((entry) => entry.choice.trim().toLowerCase() === picked);
  if (!item) return null;
  const speaker = getCastMember(item.speaker);
  return (
    <div className="mt-3">
      <CharacterMessage
        speaker={{
          name: speaker?.name ?? item.speaker,
          ...(speaker && { role: speaker.role, initials: speaker.initials }),
        }}
        tone={speaker?.tone ?? "teammate"}
      >
        {item.text}
      </CharacterMessage>
    </div>
  );
}

interface FindingsProps {
  report: CaseReportSpec;
  run: CaseRunState;
  onChangeReport: () => void;
}

/** Each report answer and how it landed, with what it means once it's supported. */
function Findings({ report, run, onChangeReport }: FindingsProps) {
  const findings = gradeReport(report, reportAnswers(run.reportDraft, run.citations), run.pins);
  const supported = supportedCount(findings);
  const total = report.questions.length;
  return (
    <section aria-labelledby="debrief-findings" className="mt-8">
      <h2 id="debrief-findings" className="text-xl font-semibold">
        Your report: {supported} of {total} {total === 1 ? "finding" : "findings"} supported
      </h2>
      <ol className="mt-4 space-y-4">
        {report.questions.map((question, index) => {
          const finding = findings[index];
          if (!finding) return null;
          const badge = BADGE[finding.verdict];
          const answer = run.reportDraft[question.id];
          return (
            <li
              key={question.id}
              className="rounded-lg border border-subtle bg-surface-raised px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="leading-7 font-semibold">{question.ask}</p>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>
              <p className="mt-1 leading-7 text-secondary">
                You wrote: {answer ? <span className="text-primary">{answer}</span> : "nothing yet"}
              </p>
              <p className="mt-1 text-sm leading-6 text-secondary">
                You cited:{" "}
                {finding.cited.length > 0 ? (
                  <span className="font-mono break-all text-primary">
                    {finding.cited.join(", ")}
                  </span>
                ) : (
                  "nothing"
                )}
              </p>
              <ChoiceFeedback question={question} answer={answer} reason={finding.reason} />
              <p className="mt-2 leading-7">{nextStep(finding.reason, question)}</p>
              {finding.verdict === "supported" && (
                <p className="mt-2 leading-7 text-secondary">
                  <CaseText text={question.explain} />
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant={supported < total ? "primary" : "secondary"} onClick={onChangeReport}>
          Change your report
        </Button>
      </div>
      {supported < total && (
        <p className="mt-2 text-sm leading-6 text-secondary">
          Change an answer, cite something else, or go back to the workspace to pin more, then
          submit again. Nothing is lost, however many times you do.
        </p>
      )}
    </section>
  );
}

interface CustodyProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  evidence: EvidenceSet | null;
}

/** The chain of custody in full, and the plain-text record to download. */
function Custody({ caseDef, run, evidence }: CustodyProps) {
  const log = useMemo(() => custodyLog(run.events, run.marks), [run.events, run.marks]);
  const download = () => {
    const text = custodyText(log, {
      caseTitle: caseDef.title,
      caseId: caseDef.id,
      client: caseDef.client.org,
      signedBy: caseDef.client.signedBy,
      handover: evidence?.handover ?? [],
      exportedAt: `${formatInstant(Date.now())} (your computer's clock)`,
      formatTime: (at) => formatInstant(at),
    });
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${caseDef.id}-custody-record-SIMULATED.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section aria-labelledby="debrief-custody" className="mt-8">
      <h2 id="debrief-custody" className="text-xl font-semibold">
        Your chain of custody
      </h2>
      <p className="mt-2 leading-7 text-secondary">
        Everything you did to the evidence, in the order you did it. A record like this is what lets
        someone else trust your findings: it shows the copy was checked before anything was read
        from it.
      </p>
      <div className="mt-4">
        <CustodyList log={log} emptyTitleAs="h3" />
      </div>
      <div className="mt-4">
        <Button variant="secondary" icon={<DownloadIcon />} onClick={download}>
          Download the custody record
        </Button>
        <p className="mt-2 text-sm text-muted">
          A plain text file, stamped SIMULATED, made on your computer. Nothing is sent anywhere.
        </p>
      </div>
    </section>
  );
}
