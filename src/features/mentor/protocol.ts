/**
 * The wire protocol between the browser and the mentor routes, and the small set of constants both
 * sides share (docs/plan/14-mentor.md). Kept free of any server-only import, so both the client
 * (`index.ts`) and the server (`server.ts`) can use it.
 *
 * Vendored from `../hacker-simulation/src/features/mentor/protocol.ts` and adapted to cases: a
 * request names a **case**, not a mission, and "Explain this" reaches three investigator views as
 * well as the terminal (VENDORED.md).
 */

/** There are three authored hint tiers per objective: a nudge, the idea, then a near-answer. */
export type HintTier = 1 | 2 | 3;

export const HINT_TIERS: readonly HintTier[] = [1, 2, 3];

/** What each tier is, in the player's words: shown beside the tier number, never as a cost. */
export const HINT_TIER_LABELS: Readonly<Record<HintTier, string>> = {
  1: "a nudge",
  2: "the idea",
  3: "nearly the answer",
};

/** The three things the mentor does. Each has its own route, prompt and log line. */
export type MentorKind = "hint" | "explain" | "review";

/** The routes the browser calls. Same-origin; the API key stays on the server. */
export const MENTOR_ENDPOINTS: Readonly<Record<MentorKind, string>> = {
  hint: "/api/mentor/hint",
  explain: "/api/mentor/explain",
  review: "/api/mentor/review",
};

/**
 * Where an "Explain this" came from. The terminal is one surface; the three investigator views
 * (docs/plan/14 §Spec) are the others, and each hands over the row exactly as it is drawn.
 */
export type ExplainView = "terminal" | "evidence" | "timeline" | "board";

/** The views' names, for the question the panel shows back ("a row in the Evidence Browser"). */
export const EXPLAIN_VIEW_LABELS: Readonly<Record<ExplainView, string>> = {
  terminal: "the terminal",
  evidence: "the Evidence Browser",
  timeline: "the timeline",
  board: "the case board",
};

/**
 * What the player asked Noor to explain (docs/plan/14 §Spec, "Explain this"):
 *  - `output`: something the terminal showed. `scope` says whether it's one line or everything a
 *    command printed; `error` marks an error line. The server looks the command's **man page** up
 *    in the tool registry and puts that in the prompt — the player's own text is untrusted and goes
 *    in as data.
 *  - `row`: a row the player pointed at in the Evidence Browser, the timeline or the case board,
 *    as that view rendered it. `title` is the row's heading, when it has one. The evidence set is
 *    never sent: the rendered row is the whole subject.
 *  - `term`: a glossary word, by id. The server loads the definition from the glossary itself.
 */
export type ExplainSubject =
  | {
      readonly kind: "output";
      readonly command: string;
      readonly text: string;
      readonly scope: "line" | "output";
      readonly error: boolean;
    }
  | {
      readonly kind: "row";
      readonly view: Exclude<ExplainView, "terminal">;
      /** The row as the view draws it: one line of rendered text. */
      readonly text: string;
      /** The row's heading, when the view gives one ("security record 57"). */
      readonly title?: string;
    }
  | { readonly kind: "term"; readonly termId: string };

/** Which surface a subject came from, for the log line and the prompt's framing. */
export function subjectView(subject: ExplainSubject): ExplainView {
  return subject.kind === "row" ? subject.view : "terminal";
}

/** Header the route sets so a client (or a proxy) can see at a glance which path answered. */
export const MENTOR_MODE_HEADER = "x-mentor-mode";

/** The streaming media type: newline-delimited JSON, one event per line. */
export const MENTOR_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

/**
 * Why a request fell back to the authored text. Metadata only, logged and sent to the client so it
 * can show the text written ahead of time; it never carries player text. `disabled` covers both the
 * kill switch and a missing API key, so the reason never reveals which.
 */
export type MentorFallbackReason =
  | "disabled"
  | "cross_site"
  | "request_too_large"
  | "invalid_request"
  | "unknown_target"
  | "no_hints"
  | "model_error"
  | "validation_rejected"
  | "empty_output"
  | "unreadable_output";

/**
 * One line of the NDJSON stream:
 *  - `text`: a chunk of Noor's rewritten hint, safe to show (it passed validation).
 *  - `fallback`: stop and show the authored tier text verbatim; anything shown so far is discarded.
 *  - `done`: the model finished and every chunk was released.
 */
export type MentorStreamEvent =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "fallback"; readonly reason: MentorFallbackReason }
  | { readonly type: "done" };

/** How the mentor answered: `model` is Noor's live rewrite, `fallback` the authored text. */
export type MentorMode = "model" | "fallback";

/** What a hint or explanation request resolves to: the mode, and the text to show. */
export interface MentorHintResult {
  readonly mode: MentorMode;
  readonly text: string;
}

export type MentorTextResult = MentorHintResult;

/** The player gets a moment to try each hint before the next tier unlocks: 30 seconds. */
export const HINT_COOLDOWN_MS = 30_000;

/**
 * When the next tier unlocks, given when the current tier was shown. Pure, so the UI and its tests
 * agree. Tier 1 has no previous tier, so it is available immediately (no call to this).
 */
export function nextTierUnlockTime(currentTierShownAt: number): number {
  return currentTierShownAt + HINT_COOLDOWN_MS;
}

/** Whether the next tier can be shown yet, given when the current tier was shown and the time now. */
export function isNextTierUnlocked(currentTierShownAt: number, now: number): boolean {
  return now >= nextTierUnlockTime(currentTierShownAt);
}
