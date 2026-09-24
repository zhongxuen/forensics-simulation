import type { MentorCase } from "./case-view";
import { renderTranscript, screenBlock } from "./prompts/noor.v1";
import {
  buildReviewSystemPrompt,
  buildReviewUserMessage,
  REVIEW_PROMPT_VERSION,
} from "./prompts/review.v1";
import type { HintPrompt } from "./prompt-builder";
import type { MentorReviewRequest } from "./schema";

/**
 * Builds exactly what is sent to the model for the debrief review (docs/plan/14-mentor.md §Spec).
 * Vendored from `../hacker-simulation/src/features/mentor/review-prompt.ts` and adapted
 * (VENDORED.md): it takes a `MentorCase`, and it carries the **order of the chain of custody**,
 * which the sibling had nothing like.
 *
 * Pure and unit-tested. Everything about the case comes from the projection, looked up by the ids
 * in the request: the words of every main objective, and of the bonuses and secrets the player
 * found. Never a hint's text, an objective's check or success line, a secret they haven't found, a
 * report answer, an accepted ref, the story's ground truth, or the debrief's copy.
 *
 * The custody facts that travel are the entry **kinds**, in order, and two booleans. A digest, a
 * path, a record number or a ref would be evidence; none of them is here.
 */

export interface ReviewPromptBuild {
  readonly prompt: HintPrompt;
  /** The lesson ids the model may suggest: the case's concepts, then its further reading. */
  readonly lessonIds: readonly string[];
}

/** The custody kinds the review prompt will state, so a forged request can't invent new ones. */
const CUSTODY_KINDS: ReadonlySet<string> = new Set([
  "acquired",
  "hashed",
  "original-read",
  "recovered",
  "carved",
  "examined",
  "pinned",
  "submitted",
]);

/** Drops anything that isn't one of the record's own kinds. */
export function knownCustodyKinds(order: readonly string[]): string[] {
  return order.filter((kind) => CUSTODY_KINDS.has(kind));
}

export function buildReviewPrompt(
  caseView: MentorCase,
  request: Pick<
    MentorReviewRequest,
    | "completed"
    | "hintsOpened"
    | "custody"
    | "pinCount"
    | "findings"
    | "minutes"
    | "resets"
    | "commandCount"
    | "transcript"
  >,
): ReviewPromptBuild {
  const completed = new Set(request.completed);
  const hints = (id: string) => Math.min(3, Math.max(0, request.hintsOpened[id] ?? 0));
  const { lessonIds } = caseView;

  const system = buildReviewSystemPrompt({
    caseTitle: caseView.title,
    learningGoals: caseView.learningGoals,
    mainObjectives: caseView.objectives
      .filter((objective) => !objective.optional)
      .map((objective) => ({
        description: objective.description,
        done: completed.has(objective.id),
        hintsOpened: hints(objective.id),
      })),
    // Only what the player found: an unfound secret stays out, so the review can't give it away.
    extrasFound: caseView.objectives
      .filter((objective) => objective.optional && completed.has(objective.id))
      .map((objective) => ({
        name: objective.name ?? "Bonus",
        description: objective.description,
      })),
    custody: {
      order: knownCustodyKinds(request.custody.order),
      hashedFirst: request.custody.hashedFirst,
      readAroundBlocker: request.custody.readAroundBlocker,
    },
    pinCount: request.pinCount,
    findings: request.findings,
    minutes: request.minutes,
    resets: request.resets,
    commandCount: request.commandCount,
    lessonIds,
  });

  const content = buildReviewUserMessage(screenBlock(renderTranscript(request.transcript)));
  return {
    lessonIds,
    prompt: { version: REVIEW_PROMPT_VERSION, system, messages: [{ role: "user", content }] },
  };
}
