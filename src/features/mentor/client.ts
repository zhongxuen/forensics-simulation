import {
  MENTOR_ENDPOINTS,
  MENTOR_MODE_HEADER,
  type ExplainSubject,
  type HintTier,
  type MentorHintResult,
  type MentorStreamEvent,
  type MentorTextResult,
} from "./protocol";
import {
  buildFallbackReview,
  MentorReviewSchema,
  type MentorReviewResult,
  type ReviewFacts,
} from "./review";
import type { MentorTranscript } from "./transcript";

/**
 * The browser side of the mentor routes (docs/plan/14-mentor.md). Vendored from
 * `../hacker-simulation/src/features/mentor/client.ts` and adapted to cases (VENDORED.md).
 *
 * Every request here always resolves: a network error, a rate limit (the Vercel Firewall rule on
 * /api/mentor/*), the kill switch, a rejected response, or any non-OK status all resolve to the
 * text written ahead of time, so the player never sees an error. They re-throw only on a
 * caller-triggered abort, so cleanup can ignore it. Nothing here imports the SDK or a key.
 */

/**
 * The little a request needs to know about the case it is for: its id, and the authored hints it
 * already holds for the fallback. Structural, so this feature never imports the cases feature
 * (which imports this one) — `RunnableCase` satisfies it as it is.
 */
export interface MentorCaseRef {
  readonly id: string;
  readonly objectives: readonly {
    readonly id: string;
    readonly hints: readonly string[];
  }[];
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Posts `body` to a text route and streams the answer through `onText` (the full text so far, not
 * just the new chunk). Resolves to `model` with the mentor's text, or `fallback` with `fallbackText`
 * verbatim (also passed to `onText` once).
 */
async function requestMentorText(
  endpoint: string,
  body: unknown,
  fallbackText: string,
  onText?: (text: string) => void,
  signal?: AbortSignal,
): Promise<MentorTextResult> {
  const respondWithFallback = (): MentorTextResult => {
    onText?.(fallbackText);
    return { mode: "fallback", text: fallbackText };
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    return respondWithFallback();
  }

  // A rate limit (429) or any non-OK status is not an error to the player: show the authored text.
  if (!response.ok || !response.body || response.headers.get(MENTOR_MODE_HEADER) === "fallback") {
    return respondWithFallback();
  }

  try {
    let accumulated = "";
    for await (const event of readNdjson(response.body)) {
      if (event.type === "text") {
        accumulated += event.text;
        onText?.(accumulated);
      } else if (event.type === "fallback") {
        return respondWithFallback();
      } else if (event.type === "done") {
        return accumulated.trim() === ""
          ? respondWithFallback()
          : { mode: "model", text: accumulated };
      }
    }
    // The stream ended without a `done`: treat as a fallback.
    return respondWithFallback();
  } catch (error) {
    if (isAbort(error)) throw error;
    return respondWithFallback();
  }
}

/** Reads a newline-delimited-JSON body one event at a time. Unparseable lines are skipped. */
async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<MentorStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        const event = parseEvent(line);
        if (event) yield event;
        newline = buffer.indexOf("\n");
      }
    }
    const last = buffer.trim();
    if (last !== "") {
      const event = parseEvent(last);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEvent(line: string): MentorStreamEvent | undefined {
  if (line === "") return undefined;
  try {
    const value = JSON.parse(line) as MentorStreamEvent;
    return value && typeof value === "object" && "type" in value ? value : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------------------------

export interface RequestMentorHintOptions {
  readonly caseDef: MentorCaseRef;
  readonly objectiveId: string;
  readonly tier: HintTier;
  /** The player's recent terminal activity, already capped. Empty when no terminal is attached. */
  readonly transcript: MentorTranscript;
  /**
   * Called as Noor's hint streams in, with the full text so far (not just the new chunk), so the UI
   * can set it directly. On a fallback it is called once with the authored text.
   */
  readonly onText?: (text: string) => void;
  readonly signal?: AbortSignal;
}

/** The authored tier text the client already holds and always falls back to (verbatim). */
export function authoredHint(caseDef: MentorCaseRef, objectiveId: string, tier: HintTier): string {
  const objective = caseDef.objectives.find((candidate) => candidate.id === objectiveId);
  return objective?.hints[tier - 1] ?? "";
}

/**
 * Asks Noor to personalise the authored hint. Streams her text through `onText`, and always resolves
 * to `{ mode, text }`: `model` with her rewrite, or `fallback` with the authored tier text verbatim.
 */
export function requestMentorHint(options: RequestMentorHintOptions): Promise<MentorHintResult> {
  const { caseDef, objectiveId, tier, transcript, onText, signal } = options;
  return requestMentorText(
    MENTOR_ENDPOINTS.hint,
    { caseId: caseDef.id, objectiveId, tier, transcript },
    authoredHint(caseDef, objectiveId, tier),
    onText,
    signal,
  );
}

// ---------------------------------------------------------------------------------------------
// "Explain this"
// ---------------------------------------------------------------------------------------------

export interface RequestMentorExplainOptions {
  readonly caseId: string;
  /** The objective the player is on, for context. */
  readonly objectiveId?: string;
  readonly subject: ExplainSubject;
  readonly transcript: MentorTranscript;
  /**
   * The explanation written ahead of time, shown verbatim if the mentor is unavailable: the
   * terminal's beginner explainer, its "What just happened?" walk-through, a view's own line for a
   * row, or the glossary entry.
   */
  readonly fallback: string;
  readonly onText?: (text: string) => void;
  readonly signal?: AbortSignal;
}

/** Asks Noor to explain a line, a result, an error, a row or a word. Always resolves, like a hint. */
export function requestMentorExplain(
  options: RequestMentorExplainOptions,
): Promise<MentorTextResult> {
  const { caseId, objectiveId, subject, transcript, fallback, onText, signal } = options;
  return requestMentorText(
    MENTOR_ENDPOINTS.explain,
    { caseId, ...(objectiveId !== undefined && { objectiveId }), subject, transcript },
    fallback,
    onText,
    signal,
  );
}

// ---------------------------------------------------------------------------------------------
// The debrief review
// ---------------------------------------------------------------------------------------------

export interface RequestMentorReviewOptions {
  readonly caseId: string;
  readonly facts: ReviewFacts;
  /** The run's terminal activity, capped with REVIEW_TRANSCRIPT_LIMITS. */
  readonly transcript: MentorTranscript;
  readonly signal?: AbortSignal;
}

/**
 * Asks Noor to look back at the run. Resolves to her review, or to the template review built from
 * the run's facts when she's unavailable (`mode: "fallback"`). Only ids, counts, the shape of the
 * chain of custody and the capped transcript are sent: the server looks up every word about the
 * case itself, and no report answer travels in either direction.
 */
export async function requestMentorReview(
  options: RequestMentorReviewOptions,
): Promise<MentorReviewResult> {
  const { caseId, facts, transcript, signal } = options;
  const fallback: MentorReviewResult = { mode: "fallback", review: buildFallbackReview(facts) };
  try {
    const response = await fetch(MENTOR_ENDPOINTS.review, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        caseId,
        completed: facts.objectives.filter((objective) => objective.done).map((o) => o.id),
        hintsOpened: Object.fromEntries(
          facts.objectives
            .filter((objective) => objective.hintsOpened > 0)
            .map((objective) => [objective.id, Math.min(3, objective.hintsOpened)]),
        ),
        custody: facts.custody,
        pinCount: facts.pinCount,
        findings: facts.findings,
        minutes: facts.minutes,
        resets: facts.resets,
        commandCount: facts.commandLines.length,
        transcript,
      }),
      signal,
    });
    if (!response.ok || response.headers.get(MENTOR_MODE_HEADER) === "fallback") return fallback;
    const data = (await response.json()) as { mode?: unknown; review?: unknown };
    if (data.mode !== "model") return fallback;
    const parsed = MentorReviewSchema.safeParse(data.review);
    return parsed.success ? { mode: "model", review: parsed.data } : fallback;
  } catch (error) {
    if (isAbort(error)) throw error;
    return fallback;
  }
}
