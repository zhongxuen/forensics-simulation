import type { CastId } from "@/content/cast";
import type { ScenarioSpec, SimEventType } from "@/sim/types";
import type { CustodyRule } from "../custody";

/**
 * What the case runner needs from a case: the briefing, the objectives with their hints, the story
 * lines, and the analyst workstation the terminal runs on.
 *
 * This is the runner's own view of a case, deliberately smaller than the case YAML schema
 * (`src/content/cases/schema.ts`): the practice case is written in this shape directly, and
 * `toRunnableCase` (loader/runnable.ts, server-only) maps a case file onto it, with every
 * evidence pattern already resolved into the refs it matches. The field names are the mission
 * schema's (`../hacker-simulation/src/content/schemas/mission.ts`), so the mapping is mostly one to
 * one. Everything here is plain data, so a server page can hand it to the runner.
 */
export interface RunnableCase {
  /** Stable id: the save's key in storage, and the evidence set's `caseId`. */
  readonly id: string;
  /** The last part of the URL: `/cases/<slug>`. */
  readonly slug: string;
  readonly title: string;
  /** One line that makes you want to open it. */
  readonly hook: string;
  readonly estimatedMinutes: number;
  /** Who asked for help, and who signed the letter saying what may be examined (99 §Six rules). */
  readonly client: CaseClient;
  readonly briefing: CaseBriefing;
  /** Main objectives first, in order; bonuses (`optional`) and secrets (`hidden`) after. */
  readonly objectives: readonly CaseObjective[];
  /** Story lines that play as the case goes: on start, when an objective ticks, on completion. */
  readonly story: readonly CaseBeat[];
  /** The fixes the client can make: every case ends with one (99 §Six rules, rule 3). */
  readonly defensiveTakeaway: string;
  /** The analyst workstation for this case: the engine scenario the terminal runs. */
  readonly scenario: ScenarioSpec;
  readonly seed: number;
  /** The report's questions with their answer key. Without one, the report is a free summary. */
  readonly report?: CaseReportSpec;
  /** What the debrief says beyond the ticks. The practice case has none. */
  readonly debrief?: CaseDebriefSpec;
}

/**
 * The report a case asks for, answer key included. The key ships with the case on purpose, as it
 * does in the case file: nothing is recorded anywhere, so reading it only spoils your own case.
 * What keeps the exercise honest is that an answer has to point at evidence on the board.
 */
export interface CaseReportSpec {
  readonly questions: readonly CaseReportQuestion[];
}

export type CaseReportAnswerType = "choice" | "timestamp" | "evidence-pick" | "account" | "host";

export interface CaseReportQuestion {
  readonly id: string;
  readonly ask: string;
  readonly type: CaseReportAnswerType;
  /** For a choice question, the choices, in the order the case file gives them. */
  readonly choices?: readonly string[];
  readonly answer: string;
  /** For a timestamp question: the instant the answer means, and how far off still counts. */
  readonly answerAt?: number;
  readonly toleranceSeconds?: number;
  /** Every ref an answer may point at, resolved when the evidence was built. */
  readonly acceptedRefs: readonly string[];
  /** What the answer means, shown once it is given. */
  readonly explain: string;
}

export interface CaseDebriefSpec {
  /** What the player worked out, in a sentence or two. */
  readonly summary: string;
  readonly whatYouLearned: readonly string[];
  readonly ethicsNote: string;
  /** A one-line hook for the next case. */
  readonly nextTease?: string;
}

export interface CaseClient {
  /** The organisation, from the world facts: "Quillfen Freight". */
  readonly org: string;
  /** Who signed, by role unless they're in the cast: "the owner of Quillfen Freight". */
  readonly signedBy: string;
  /** What the letter lets you examine, in a sentence or two. */
  readonly scope: string;
}

export interface CaseBriefing {
  /**
   * The cold open: at most two lines before the first objective, each from a cast member, whose
   * name and role show on their first line (99 §Story world, "Cold opens").
   */
  readonly opening: readonly CaseLine[];
  /** The situation, in two or three sentences. */
  readonly situation: string;
}

export interface CaseLine {
  readonly speaker: CastId;
  readonly text: string;
}

export interface CaseBeat extends CaseLine {
  readonly on: "start" | "complete" | { readonly objective: string };
}

export interface CaseObjective {
  readonly id: string;
  /** Starts with a verb. Commands and paths in `backticks`. */
  readonly description: string;
  /** Why it matters, in one sentence. */
  readonly why: string;
  /** What you did, said when it ticks. Specific. */
  readonly success: string;
  /** Bonuses and secrets. Playful names. */
  readonly name?: string;
  readonly optional?: boolean;
  /** A secret: off the list until found. */
  readonly hidden?: boolean;
  /**
   * Three tiers. Tier 1 doesn't name the command (99 §Authoring checklist). A secret may have
   * none: it is off the list until it's found, so nobody can ask for one.
   */
  readonly hints: readonly [string, string, string] | readonly [];
  readonly check: ObjectiveCheck;
}

/**
 * How an objective is checked (run/evaluate.ts): the mission schema's `event` and `commandRun`,
 * and the case schema's forensics kinds — a pin on the board, a report answer that's supported, a
 * rule about the order of the chain of custody, and groups of checks. A case file's `pinned` pattern arrives already resolved into refs, so the
 * browser never needs the evidence to check it.
 */
export type ObjectiveCheck =
  | {
      readonly kind: "all" | "any";
      readonly of: readonly ObjectiveCheck[];
    }
  | {
      readonly kind: "pinned";
      /** Any one of these on the board holds. */
      readonly refs: readonly string[];
    }
  | {
      /** A rule about the order of the chain of custody (custody/custody-log.ts). */
      readonly kind: "custody";
      readonly rule: CustodyRule;
    }
  | {
      readonly kind: "reported";
      /** The report question whose answer has to be supported. */
      readonly question: string;
    }
  | {
      readonly kind: "event";
      readonly event: SimEventType;
      /** Every field here must equal the event's field of the same name. */
      readonly match?: Readonly<Record<string, string | number | boolean>>;
    }
  | {
      readonly kind: "commandRun";
      /** A regular expression (no flags) tested against the whole command line. */
      readonly pattern: string;
      /** Count it even when the command didn't work. */
      readonly anyExitCode?: boolean;
    };
