"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { CharacterMessage } from "@/components/ui/character-message";
import { Dialog } from "@/components/ui/dialog";
import { ArrowRightIcon, CheckIcon, DownloadIcon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import { Stamp } from "@/components/ui/stamp";
import { getCastMember } from "@/content/cast";
import { CHAPTER_ONE, isReleased } from "@/content/cases/chapter";
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
import { findCaseListing } from "../../run/catalog";
import { caseProgress } from "../../run/evaluate";
import { CaseText } from "../case-text";
import { SUMMARY_QUESTION } from "../report/report-screen";
import { ChapterClosing } from "./chapter-closing";
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
 * Where the debrief's main button goes: the chapter's next case once it's released. Null after the
 * last case, or while the next one is still being written, when the button is Back to your cases.
 */
export function nextCaseFor(slug: string): { href: string; title: string } | null {
  const index = CHAPTER_ONE.cases.indexOf(slug);
  const next = index === -1 ? undefined : CHAPTER_ONE.cases[index + 1];
  if (next === undefined || !isReleased(next)) return null;
  return { href: `/cases/${next}`, title: findCaseListing(next)?.title ?? next };
}

/**
 * The debrief (UIUX.md §2.7). It leads with the moment: a "Case closed" stamp and "**n of m
 * findings supported**" (never a score, never a number that can go down), then how each report
 * answer landed, with its meaning shown once it's supported. Then the chain of custody in full,
 * ready to download, the objectives in brief, what you learned and what the client can fix. One
 * main button, the next step: Next case, or Back to your cases when there isn't one (Change your
 * report takes its place while a finding still isn't supported). Start the case again waits in
 * the "⋯ Case" menu, behind its confirm dialog. The report can be changed and submitted again
 * from here as often as the player likes.
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
  const report = caseDef.report && caseDef.report.questions.length > 0 ? caseDef.report : null;
  const findings = useMemo(
    () =>
      report ? gradeReport(report, reportAnswers(run.reportDraft, run.citations), run.pins) : null,
    [report, run.reportDraft, run.citations, run.pins],
  );
  // While a finding isn't supported yet, Change your report is the next step, so it's the one
  // primary button on the screen; once they all are, the next case is.
  const reportDone = findings === null || supportedCount(findings) === findings.length;
  const next = nextCaseFor(caseDef.slug);
  const objectivesLine = `${done} of ${total} objectives done.${
    extras.length > 0
      ? ` You found ${extras.length === 1 ? "1 bonus" : `${extras.length} bonuses`} too.`
      : ""
  }`;

  return (
    <article aria-labelledby="case-debrief-title" className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="type-eyebrow">Debrief</p>
          <h1
            id="case-debrief-title"
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 type-page-title outline-none"
          >
            <span className="sr-only">Case closed: </span>
            {caseDef.title}
          </h1>
        </div>
        {/* The stamp's words start the heading already, so they're read once. */}
        <div aria-hidden="true" className="pt-1 pr-2">
          <Stamp celebrate>Case closed</Stamp>
        </div>
      </header>

      {report && findings ? (
        <Findings
          report={report}
          findings={findings}
          run={run}
          onChangeReport={changeReport}
          primary={!reportDone}
        />
      ) : (
        <p className="mt-6 type-section-title">{objectivesLine}</p>
      )}

      <Custody caseDef={caseDef} run={run} evidence={evidence} />

      <section aria-labelledby="debrief-objectives" className="mt-10">
        <h2 id="debrief-objectives" className="type-section-title">
          Objectives
        </h2>
        {report && <p className="mt-1 type-small text-secondary">{objectivesLine}</p>}
        <ul className="mt-3 space-y-1.5">
          {caseDef.objectives
            .filter((objective) => run.completed.includes(objective.id))
            .map((objective) => (
              <li key={objective.id} className="flex gap-2.5 type-small">
                <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-reward" />
                <span>
                  {objective.name && <span className="font-semibold">{objective.name}: </span>}
                  <CaseText text={objective.success} />
                </span>
              </li>
            ))}
        </ul>
      </section>

      {caseDef.debrief && (
        <>
          <p className="mt-10 max-w-prose type-body">
            <CaseText text={caseDef.debrief.summary} />
          </p>
          <section aria-labelledby="debrief-learned" className="mt-6">
            <h2 id="debrief-learned" className="type-eyebrow">
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
            <h2 id="debrief-ethics" className="type-eyebrow">
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

      {caseDef.slug === CHAPTER_ONE.cases.at(-1) && <ChapterClosing chapter={CHAPTER_ONE} />}

      {summary && (
        <section aria-labelledby="debrief-summary" className="mt-6">
          <h2 id="debrief-summary" className="type-eyebrow">
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

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-subtle pt-6">
        {next ? (
          <ButtonLink
            href={next.href}
            variant={reportDone ? "primary" : "secondary"}
            icon={<ArrowRightIcon />}
          >
            Next case: {next.title}
          </ButtonLink>
        ) : (
          <ButtonLink href="/cases" variant={reportDone ? "primary" : "secondary"}>
            Back to your cases
          </ButtonLink>
        )}
        <Button variant="secondary" onClick={() => dispatch({ type: "resume" })}>
          Back to the workspace
        </Button>
        <Menu
          label="Case"
          align="start"
          items={[
            {
              id: "restart",
              label: "Start the case again",
              tone: "danger",
              onSelect: () => setConfirmRestart(true),
            },
          ]}
        />
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

/** How far apart the findings' chips resolve, and the latest any of them starts (UIUX.md §5). */
const CHIP_STAGGER_MS = 80;
const CHIP_LAST_START_MS = 480;

/**
 * After a submit each finding's chip resolves in turn: it pops in 80 ms after the one before, so
 * the whole run ends inside celebrate-long. The delay scales with --motion-scale like every other
 * effect, so under reduced motion they're all there at once. The status word is text from the
 * start, for screen readers and for anyone who reads ahead.
 */
export function chipDelay(index: number): CSSProperties {
  const ms = Math.min(index * CHIP_STAGGER_MS, CHIP_LAST_START_MS);
  return { animationDelay: `calc(${ms}ms * var(--motion-scale))` };
}

interface FindingsProps {
  report: CaseReportSpec;
  findings: readonly Finding[];
  run: CaseRunState;
  onChangeReport: () => void;
  /** Whether Change your report is the screen's one primary button: while a finding isn't supported. */
  primary: boolean;
}

/** "n of m findings supported", then each report answer and how it landed. */
function Findings({ report, findings, run, onChangeReport, primary }: FindingsProps) {
  const supported = supportedCount(findings);
  const total = report.questions.length;
  const count = `${supported} of ${total} ${total === 1 ? "finding" : "findings"} supported`;
  return (
    <section aria-labelledby="debrief-findings" className="mt-6">
      {/* Named in one piece: browsers disagree on the spaces between a heading's block parts. */}
      <h2 id="debrief-findings" aria-label={`Your report: ${count}`}>
        <span className="block type-eyebrow">Your report</span>
        <span className="mt-1 block type-page-title">{count}</span>
      </h2>
      <ol className="mt-6 space-y-4">
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
                <p className="leading-7 font-semibold">
                  <span className="text-secondary">{index + 1}.</span> {question.ask}
                </p>
                <span className="inline-flex animate-pop" style={chipDelay(index)}>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </span>
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
        <Button variant={primary ? "primary" : "secondary"} onClick={onChangeReport}>
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
    <section aria-labelledby="debrief-custody" className="mt-10">
      <h2 id="debrief-custody" className="type-section-title">
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
