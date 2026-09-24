import type { HintTier } from "./protocol";

/**
 * What the mentor's server side is allowed to know about a case (docs/plan/14-mentor.md §Spec:
 * "The answer key is never loaded into the model's context at all: the route loads only the
 * objective and its hints").
 *
 * This is the forensics game's own addition to the vendored mentor (VENDORED.md). Hacker
 * Simulation's handlers take a whole `Mission` and rely on the prompt builders to leave the answer
 * key out. A case file carries far more that must never reach a model — the ground-truth `story`,
 * every report question's `answer` and `acceptedEvidence`, each objective's `check` and `success`
 * line, the debrief's summary — so leaving it out is made **structural** instead of a convention:
 *
 *   - `toMentorCase` projects a case down to the fields below and nothing else.
 *   - Every handler, prompt builder and deps type downstream takes a `MentorCase`, never a `Case`.
 *
 * So the answer key isn't merely absent from the prompt: it is absent from the type the prompt is
 * built from, and a prompt builder that wanted it could not compile.
 * `tests/mentor/answer-key.test.ts` walks the projection of every real case and fails if a single
 * character of an answer, a check, a success line or the story survives it.
 */

/** One objective, as the mentor may see it: what to do, why, and the hints already authored. */
export interface MentorObjective {
  readonly id: string;
  /** What to do, starting with a verb. Commands and paths in `backticks`. */
  readonly description: string;
  /** Why this step matters, in one line. */
  readonly why: string;
  /** The playful name of a bonus objective or secret. */
  readonly name?: string;
  readonly optional: boolean;
  /** A secret: off the list until found, and it ships no hints, so none can be asked for. */
  readonly hidden: boolean;
  /** Three authored tiers, or none for a secret. */
  readonly hints: readonly string[];
}

/**
 * A case with the answer key projected away. Note what is **not** here, and cannot be added
 * without changing this file: `story` (the ground truth), `report` (every answer and every
 * accepted ref), `evidence`, `machines`, `noise`, each objective's `check` and `success`, the
 * debrief's `summary`, `whatYouLearned`, `ethicsNote` and `nextTease`, and the case's `beats`.
 */
export interface MentorCase {
  readonly id: string;
  readonly title: string;
  /** "You'll learn…", which the review is allowed to speak to. */
  readonly learningGoals: readonly string[];
  /** Lesson ids the review may suggest: the case's concepts, then its further reading. */
  readonly lessonIds: readonly string[];
  readonly objectives: readonly MentorObjective[];
}

/**
 * The shape `toMentorCase` reads. Structural on purpose: the mentor feature never imports the
 * cases feature (which would make the two circular), and `Case` from `src/content/cases/schema.ts`
 * satisfies this without being named here. Extra fields on the input are ignored — that is the
 * whole point.
 */
export interface MentorCaseSource {
  readonly id: string;
  readonly title: string;
  readonly learningGoals: readonly string[];
  readonly concepts?: readonly string[];
  readonly debrief?: { readonly furtherReading?: readonly string[] };
  readonly objectives: readonly {
    readonly id: string;
    readonly description: string;
    readonly why: string;
    readonly name?: string;
    readonly optional?: boolean;
    readonly hidden?: boolean;
  }[];
  readonly hints: Readonly<Record<string, readonly string[]>>;
}

/**
 * Projects a case onto what the mentor may see. Every field is copied by name — there is no spread
 * of the source anywhere in this function, so a new field in the case schema can never arrive here
 * by accident.
 */
export function toMentorCase(source: MentorCaseSource): MentorCase {
  return {
    id: source.id,
    title: source.title,
    learningGoals: [...source.learningGoals],
    // Gentlest first, without repeats: the same order the review prompt offers them in.
    lessonIds: [
      ...new Set([...(source.concepts ?? []), ...(source.debrief?.furtherReading ?? [])]),
    ],
    objectives: source.objectives.map((objective) => ({
      id: objective.id,
      description: objective.description,
      why: objective.why,
      ...(objective.name !== undefined && { name: objective.name }),
      optional: objective.optional === true || objective.hidden === true,
      hidden: objective.hidden === true,
      // A secret ships no hints, so `hints[id]` is undefined and stays an empty list.
      hints: [...(source.hints[objective.id] ?? [])],
    })),
  };
}

/** The objective with this id, unless it's a secret (which is off the list until it's found). */
export function askableObjective(
  caseView: MentorCase,
  objectiveId: string,
): MentorObjective | undefined {
  const objective = caseView.objectives.find((candidate) => candidate.id === objectiveId);
  return objective && !objective.hidden ? objective : undefined;
}

/**
 * The tiers the player has already unlocked and seen: 1..tier, and never one past it. Undefined
 * when the objective ships no hints, or fewer than the tier asked for.
 */
export function unlockedTiers(
  objective: MentorObjective,
  tier: HintTier,
): readonly string[] | undefined {
  const unlocked = objective.hints.slice(0, tier);
  return unlocked.length === tier ? unlocked : undefined;
}
