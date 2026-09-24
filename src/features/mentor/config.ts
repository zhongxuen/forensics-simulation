/**
 * The mentor's server configuration, read from the environment (docs/plan/14-mentor.md, prompts
 * 10.1 and 10.5). No secret ever leaves this side: only `hasApiKey` (a boolean) is derived for
 * logging and control flow, never the key itself.
 *
 * Env vars (documented in docs/runbook.md):
 *  - ANTHROPIC_API_KEY  — the model key. Absent ⇒ every request falls back to the authored hint.
 *  - MENTOR_DISABLED     — set to "1" to kill all model calls (forces fallback) without a redeploy.
 *  - MENTOR_MODEL        — override the model id (defaults below).
 */

/**
 * Model default: Claude Haiku 4.5 (`claude-haiku-4-5`). Rewriting an authored, one-idea hint into a
 * warm sentence or two is a short, tightly-constrained task, and the safety design means the model
 * never holds the case's answer key — so the cheapest, fastest current model is the right fit. Haiku is
 * $1 / $5 per million tokens (versus $5 / $25 for Opus 5), and with the ~300-token output cap each
 * hint costs a fraction of a cent, which keeps the monthly spend limit comfortable. Overridable via
 * MENTOR_MODEL if a case ever needs more nuance.
 */
export const DEFAULT_MENTOR_MODEL = "claude-haiku-4-5";

/** The hard cap on the model's output tokens per hint. A hint is a sentence or two. */
export const MAX_OUTPUT_TOKENS = 300;

/** The cap for an "Explain this" answer: a few sentences, a little longer than a hint. */
export const MAX_EXPLAIN_OUTPUT_TOKENS = 400;

/**
 * The cap for the debrief review: a short JSON object of a few sentences. Generous enough that a
 * review is never cut off mid-object (which would only fall back to the template anyway).
 */
export const MAX_REVIEW_OUTPUT_TOKENS = 1_000;

/** How long to wait for the whole model response before falling back, in milliseconds. */
export const MODEL_TIMEOUT_MS = 15_000;

/** The review is read whole before anything is shown, so it gets a little longer. */
export const REVIEW_TIMEOUT_MS = 25_000;

/** The largest request body the route reads, in bytes. Anything larger falls back immediately. */
export const MAX_REQUEST_BODY_BYTES = 16 * 1024;

export interface MentorConfig {
  readonly hasApiKey: boolean;
  readonly apiKey: string | undefined;
  readonly disabled: boolean;
  readonly model: string;
}

/** Reads the mentor config from `process.env` (or a provided record, for tests). */
export function readMentorConfig(
  env: Record<string, string | undefined> = process.env,
): MentorConfig {
  const apiKey = env.ANTHROPIC_API_KEY?.trim() || undefined;
  return {
    hasApiKey: apiKey !== undefined,
    apiKey,
    disabled: env.MENTOR_DISABLED === "1",
    model: env.MENTOR_MODEL?.trim() || DEFAULT_MENTOR_MODEL,
  };
}
