import { getCastMember } from "@/content/cast";
import type { PlaythroughStep, ReportVerdict } from "@/content/cases/playthrough";
import type { Case, ObjectiveCheck } from "@/content/cases/schema";
import type { RunMark } from "@/lib/case-storage";
import {
  createTerminalSession,
  plainTranscript,
  resetMachine,
  submitLine,
  type TerminalSessionState,
} from "@/features/terminal";
import { attachEvidence, resolveAcceptedEvidence, EvidencePatternError } from "@/sim";
import type { ArtefactRef, EvidenceSet, SimEvent, SimState } from "@/sim/types";
import { custodyLog, custodyRuleHolds } from "../custody";
import { gradeQuestion } from "../grading";
import { caseScenario } from "./scenario";
import type { BuiltCase } from "./source";

/**
 * Headless case play (docs/plan/03-case-format-and-generator.md §Tests, group 5).
 *
 * A case is **solvable** when a written playthrough reaches every main objective and leaves every
 * report question supported, using nothing but the game's own tools. This module is what proves
 * it: command lines go through the terminal's `submitLine` — the same parser, the same engine,
 * the same tool registry the browser uses — so a playthrough that works here works in the app, and
 * a tool added to `src/sim/tools/forensics/index.ts` is usable from a playthrough the moment it is
 * registered, with nothing to change here.
 *
 * It is pure: the same case and the same steps always give the same transcript. That is what lets
 * `pnpm case:play` and the solvability test agree to the character.
 */

/** Grading a report answer (docs/plan/00-overview.md §4, row 7): no score, three verdicts. */
export interface ReportGrade {
  readonly questionId: string;
  /** What the player wrote, or "" for a question they haven't answered. */
  readonly answer: string;
  readonly verdict: ReportVerdict;
  /** The refs cited for this answer that are on the board. */
  readonly cited: readonly ArtefactRef[];
  /** The cited refs that support this answer. */
  readonly supportedBy: readonly ArtefactRef[];
  /** Every ref this answer may point at, resolved when the evidence was built. */
  readonly acceptedRefs: readonly ArtefactRef[];
}

/** Everything one played step did, for the transcript and for the checks. */
export interface CasePlayStep {
  readonly step: PlaythroughStep;
  /** The command and its output, for `run` steps, without the beginner explainer lines. */
  readonly output: string;
  /** Objectives this step ticked. */
  readonly ticked: readonly string[];
  /** Story lines this step added: `Name: text`. */
  readonly story: readonly string[];
  /** For an answer step: whether the objective accepted it. */
  readonly accepted?: boolean;
  /** For a report step: how the answer came back. */
  readonly verdict?: ReportVerdict;
  /** Something the step itself could not do, such as a pin pattern that matches nothing. */
  readonly problem?: string;
}

export interface CasePlayResult {
  readonly case: Case;
  readonly steps: readonly CasePlayStep[];
  /** Objectives ticked, in the order they were ticked. */
  readonly completed: readonly string[];
  /** Every main objective is ticked. */
  readonly complete: boolean;
  /** Each report question's verdict, in the case's question order. */
  readonly report: readonly ReportGrade[];
  /** The refs on the case board at the end, oldest first. */
  readonly pins: readonly string[];
  /** Story lines played before the first step. */
  readonly opening: readonly string[];
  /** The terminal as the play left it, for anything that wants to look at the machine. */
  readonly session: TerminalSessionState;
}

// ---------------------------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------------------------

/** The run as it stands: what the checks are asked about after every step. */
interface RunState {
  readonly events: SimEvent[];
  readonly pins: string[];
  /** Answers submitted for an objective's `answer` check, newest last. */
  readonly answers: Map<string, string[]>;
  /** What the player has written on the report so far. */
  readonly report: Map<string, string>;
  /** The refs each report answer cites, from the step's `cite` patterns. */
  readonly citations: Map<string, string[]>;
  /** Pins made from a view (`pin` steps), for the chain of custody, as the browser keeps them. */
  readonly marks: RunMark[];
}

/**
 * Plays `steps` against a case's workstation, with the case's evidence attached. Pure: the same
 * case and steps always give the same result.
 */
export function playCase(built: BuiltCase, steps: readonly PlaythroughStep[]): CasePlayResult {
  const entry = built.case;
  const { scenario, seed, startsAt } = caseScenario(entry, built.evidence);
  // A case with nothing handed over (the scaffold's) has no evidence to attach. One with only a
  // memory capture and logs (case-03) still does, as the browser's workstation always attaches.
  const { disks, memory, logs } = built.evidence;
  const attach = (sim: SimState): SimState =>
    disks.length + memory.length + logs.length === 0
      ? sim
      : attachEvidence(sim, built.evidence, { now: startsAt });

  let session = createTerminalSession({ scenario, seed });
  session = { ...session, sim: attach(session.sim) };

  const run: RunState = {
    events: [],
    pins: [],
    answers: new Map(),
    report: new Map(),
    citations: new Map(),
    marks: [],
  };
  let completed: string[] = [];
  let beatsPlayed: number[] = [];
  const played: CasePlayStep[] = [];

  const opening = playBeats(entry, beatsPlayed, (beat) => beat.on === "start");
  beatsPlayed = [...beatsPlayed, ...opening.indexes];

  for (const step of steps) {
    let output = "";
    let problem: string | undefined;
    let accepted: boolean | undefined;
    let verdict: ReportVerdict | undefined;

    if ("run" in step) {
      const before = session;
      session = submitLine(session, step.run);
      const block = session.blocks.at(-1);
      output = block && block.id >= before.nextId ? plainTranscript([block]) : `$ ${step.run}`;
      run.events.push(...session.lastEvents);
      for (const event of session.lastEvents) {
        if (event.type === "board.pinned") addPin(run.pins, event.ref);
      }
    } else if ("pin" in step) {
      try {
        const refs = resolveAcceptedEvidence(built.evidence, step.pin);
        if (refs.length === 0) {
          problem = `nothing in this case's evidence matches "${step.pin}".`;
        } else {
          for (const ref of refs) {
            if (addPin(run.pins, ref)) {
              run.marks.push({ after: run.events.length, kind: "pinned", ref });
            }
          }
          output = `[pin] ${step.pin} → ${refs.join(", ")}`;
        }
      } catch (error) {
        if (!(error instanceof EvidencePatternError)) throw error;
        problem = error.message;
      }
    } else if ("report" in step) {
      run.report.set(step.report, step.answer);
      const cited: string[] = [];
      for (const pattern of step.cite ?? []) {
        const refs = matching(built.evidence, pattern);
        if (refs.length === 0) problem = `nothing in this case's evidence matches "${pattern}".`;
        cited.push(...refs);
      }
      run.citations.set(step.report, cited);
      const question = entry.report.questions.find((item) => item.id === step.report);
      if (!question) {
        problem = `there's no report question with the id "${step.report}".`;
      } else {
        verdict = grade(built, question.id, run).verdict;
        const cites = step.cite?.length ? ` (citing ${step.cite.join(", ")})` : " (citing nothing)";
        output = `[report ${step.report}] ${step.answer}${cites} → ${verdict}`;
      }
    } else if ("objective" in step) {
      run.answers.set(step.objective, [...(run.answers.get(step.objective) ?? []), step.answer]);
      const objective = entry.objectives.find((item) => item.id === step.objective);
      if (!objective) {
        problem = `there's no objective with the id "${step.objective}".`;
      } else {
        accepted = holds(objective.check, built, run, objective.id);
        output = `[answer ${step.objective}] ${step.answer} → ${accepted ? "accepted" : "not accepted"}`;
      }
    } else {
      session = resetMachine(session);
      session = { ...session, sim: attach(session.sim) };
      output = "[Reset machine]";
    }

    // Ticks are re-checked from scratch after every step, and never taken away once earned.
    const holding = entry.objectives
      .filter((objective) => holds(objective.check, built, run, objective.id))
      .map((objective) => objective.id);
    const ticked = holding.filter((id) => !completed.includes(id));
    const wasComplete = isComplete(entry, completed);
    completed = [...completed, ...ticked];

    const beats = playBeats(
      entry,
      beatsPlayed,
      (beat) =>
        (typeof beat.on === "object" &&
          "objective" in beat.on &&
          ticked.includes(beat.on.objective)) ||
        (typeof beat.on === "object" &&
          "question" in beat.on &&
          "report" in step &&
          step.report === beat.on.question) ||
        (beat.on === "complete" && !wasComplete && isComplete(entry, completed)),
    );
    beatsPlayed = [...beatsPlayed, ...beats.indexes];

    played.push({
      step,
      output,
      ticked,
      story: beats.lines,
      ...(accepted === undefined ? {} : { accepted }),
      ...(verdict === undefined ? {} : { verdict }),
      ...(problem === undefined ? {} : { problem }),
    });
  }

  return {
    case: entry,
    steps: played,
    completed,
    complete: isComplete(entry, completed),
    report: entry.report.questions.map((question) => grade(built, question.id, run)),
    pins: [...run.pins],
    opening: opening.lines,
    session,
  };
}

/** Pins a ref, once. True when it wasn't on the board before. */
function addPin(pins: string[], ref: string): boolean {
  if (pins.includes(ref)) return false;
  pins.push(ref);
  return true;
}

/** The main objectives: not bonuses, not secrets. */
export const mainObjectiveIds = (entry: Case): string[] =>
  entry.objectives.filter((objective) => !objective.optional).map((objective) => objective.id);

const isComplete = (entry: Case, completed: readonly string[]): boolean =>
  mainObjectiveIds(entry).every((id) => completed.includes(id));

function playBeats(
  entry: Case,
  already: readonly number[],
  wanted: (beat: Case["beats"][number]) => boolean,
): { indexes: number[]; lines: string[] } {
  const indexes = entry.beats.flatMap((beat, index) =>
    !already.includes(index) && wanted(beat) ? [index] : [],
  );
  return {
    indexes,
    lines: indexes.flatMap((index) => {
      const beat = entry.beats[index];
      return beat ? [`${getCastMember(beat.speaker)?.name ?? beat.speaker}: ${beat.text}`] : [];
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// Objective checks
// ---------------------------------------------------------------------------------------------

/**
 * Whether an objective's check holds, given everything the run has done so far. Pure, and it
 * handles every kind the case schema allows, groups included (`src/content/cases/schema.ts`).
 */
function holds(
  check: ObjectiveCheck,
  built: BuiltCase,
  run: RunState,
  objectiveId: string,
): boolean {
  switch (check.kind) {
    case "all":
      return check.of.every((inner) => holds(inner, built, run, objectiveId));
    case "any":
      return check.of.some((inner) => holds(inner, built, run, objectiveId));
    case "commandRun": {
      const pattern = compiled(check.pattern);
      return run.events.some(
        (event) =>
          event.type === "command.run" &&
          (check.anyExitCode === true || event.exitCode === 0) &&
          pattern.test(event.line),
      );
    }
    case "pinned": {
      const refs = matching(built.evidence, check.evidence);
      return refs.length > 0 && refs.some((ref) => run.pins.includes(ref));
    }
    case "reported":
      return grade(built, check.question, run).verdict === "supported";
    case "custody":
      return custodyRuleHolds(check.rule, custodyLog(run.events, run.marks));
    case "answer":
      return (run.answers.get(objectiveId) ?? []).some((answer) =>
        check.accept.some((wanted) => same(answer, wanted)),
      );
  }
}

const patterns = new Map<string, RegExp>();

function compiled(pattern: string): RegExp {
  let regex = patterns.get(pattern);
  if (!regex) {
    regex = new RegExp(pattern);
    patterns.set(pattern, regex);
  }
  return regex;
}

/** A pattern's refs, or none when it doesn't resolve. Checks never throw; the build already did. */
function matching(evidence: EvidenceSet, pattern: string): ArtefactRef[] {
  try {
    return resolveAcceptedEvidence(evidence, pattern);
  } catch (error) {
    if (!(error instanceof EvidencePatternError)) throw error;
    return [];
  }
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

// ---------------------------------------------------------------------------------------------
// Grading the report
// ---------------------------------------------------------------------------------------------

/**
 * One report answer's verdict, from the same grader the browser uses (`../grading`). An answer
 * that is right but cites nothing that proves it is **needs evidence**, not a failure: the habit
 * being taught is that a finding carries the evidence it rests on, and the way to learn it is to
 * be told what is missing, not to be marked down.
 */
function grade(built: BuiltCase, questionId: string, run: RunState): ReportGrade {
  const question = built.case.report.questions.find((item) => item.id === questionId);
  const acceptedRefs = (built.acceptedRefs.get(questionId) ?? []) as readonly ArtefactRef[];
  const answer = run.report.get(questionId) ?? "";
  if (!question) {
    return { questionId, answer, acceptedRefs, cited: [], supportedBy: [], verdict: "not-yet" };
  }
  const finding = gradeQuestion(
    {
      id: question.id,
      type: question.type,
      answer: question.answer,
      ...("answerAt" in question && { answerAt: question.answerAt }),
      ...(question.toleranceSeconds !== undefined && {
        toleranceSeconds: question.toleranceSeconds,
      }),
      acceptedRefs,
    },
    { value: answer, cited: run.citations.get(questionId) ?? [] },
    run.pins,
  );
  return {
    questionId,
    answer,
    acceptedRefs,
    cited: finding.cited as readonly ArtefactRef[],
    supportedBy: finding.supportedBy as readonly ArtefactRef[],
    verdict: finding.verdict,
  };
}
