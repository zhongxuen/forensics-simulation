import { askableObjective, unlockedTiers, type MentorCase } from "./case-view";
import {
  buildHintSystemPrompt,
  buildHintUserMessage,
  HINT_PROMPT_VERSION,
  TRANSCRIPT_CLOSE,
  TRANSCRIPT_OPEN,
} from "./prompts/hint.v1";
import { renderTranscript, screenBlock } from "./prompts/noor.v1";
import type { HintTier } from "./protocol";
import type { MentorTranscript } from "./transcript";

/**
 * Builds exactly what is sent to the model for one hint request (docs/plan/14-mentor.md §Spec).
 * Vendored from `../hacker-simulation/src/features/mentor/prompt-builder.ts` and adapted to cases
 * (VENDORED.md): it takes a `MentorCase`, the answer-key-free projection of a case (case-view.ts),
 * where the sibling took a whole `Mission`.
 *
 * Pure and unit-tested: the tests assert what is present (the requested tier, the objective's
 * description and why) and, just as importantly, what is absent — the objective's `check`, its
 * `success` line, any tier after the requested one, other objectives' hints, the report's answers
 * and accepted refs, the story's ground truth and the debrief. Most of those cannot be present at
 * all: they are not on the type this function reads.
 *
 * EARLIER TIERS ARE INCLUDED, LATER TIERS ARE NOT. Tiers 1..tier are given, because the player has
 * already unlocked and seen every one of them on their own screen (tiers unlock in order), so
 * including them discloses nothing new and lets Noor build on the nudge instead of repeating it.
 * Tier+1..3 are never included: that is the structural guarantee that the model cannot hand over a
 * hint the player has not earned, even under prompt injection.
 */

export interface HintPrompt {
  readonly version: string;
  readonly system: string;
  readonly messages: readonly { readonly role: "user"; readonly content: string }[];
}

/** The reason `buildHintPrompt` can't build a prompt, so the caller falls back instead. */
export type PromptProblem = "unknown_objective" | "no_hints";

export type BuildHintPromptResult =
  | { readonly ok: true; readonly prompt: HintPrompt; readonly authoredTier: string }
  | { readonly ok: false; readonly problem: PromptProblem };

/**
 * Builds the prompt for `(case, objectiveId, tier)`. Returns the authored tier text alongside, so
 * the caller has the exact string the client will fall back to. Fails (for a graceful fallback)
 * when the objective is unknown or a secret (secrets ship no hints, and asking about one must not
 * confirm it exists).
 */
export function buildHintPrompt(
  caseView: MentorCase,
  objectiveId: string,
  tier: HintTier,
  transcript: MentorTranscript,
): BuildHintPromptResult {
  const objective = askableObjective(caseView, objectiveId);
  if (!objective) return { ok: false, problem: "unknown_objective" };

  // Only the tiers the player has unlocked: index 0..tier-1. A later tier is never read.
  const unlocked = unlockedTiers(objective, tier);
  const authoredTier = unlocked?.[tier - 1];
  if (!unlocked || authoredTier === undefined) return { ok: false, problem: "no_hints" };

  const system = buildHintSystemPrompt({
    caseTitle: caseView.title,
    requestedTier: tier,
    objectiveDescription: objective.description,
    objectiveWhy: objective.why,
    authoredTiers: unlocked,
  });

  // `screenBlock` renders the transcript into the delimited data block and neutralises every
  // delimiter tag inside it, so neither a player nor a hostile file name planted in the evidence
  // can forge a closing tag and "escape" the block.
  const content = buildHintUserMessage(screenBlock(renderTranscript(transcript)));

  return {
    ok: true,
    authoredTier,
    prompt: { version: HINT_PROMPT_VERSION, system, messages: [{ role: "user", content }] },
  };
}

export { HINT_PROMPT_VERSION, TRANSCRIPT_OPEN, TRANSCRIPT_CLOSE };
