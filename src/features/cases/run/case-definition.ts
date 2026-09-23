import type { CastId } from "@/content/cast";
import type { ScenarioSpec, SimEventType } from "@/sim/types";

/**
 * What the case runner needs from a case: the briefing, the objectives with their hints, the story
 * lines, and the analyst workstation the terminal runs on.
 *
 * This is the runner's own view of a case, deliberately smaller than the case YAML schema file 03
 * writes (`src/content/cases/schema.ts`): until that merges, the practice case below is written in
 * this shape directly, and afterwards the loader maps a parsed case onto it. The field names are
 * the mission schema's (`../hacker-simulation/src/content/schemas/mission.ts`), so the mapping is
 * mostly one to one. Everything here is plain data, so a server page can hand it to the runner.
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
  /** Three tiers. Tier 1 doesn't name the command (99 §Authoring checklist). */
  readonly hints: readonly [string, string, string];
  readonly check: ObjectiveCheck;
}

/**
 * How an objective is checked. The two kinds the stub evaluator knows (run/evaluate.ts), with the
 * mission schema's names; file 03's schema adds the forensics ones (a pin of a ref, a report
 * answer) and its evaluator replaces the stub.
 */
export type ObjectiveCheck =
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
