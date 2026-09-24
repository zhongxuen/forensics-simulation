import type { MentorCase } from "./case-view";
import { MAX_REVIEW_OUTPUT_TOKENS, REVIEW_TIMEOUT_MS, type MentorConfig } from "./config";
import type { MentorModelRunner } from "./model";
import { REVIEW_JSON_SCHEMA, REVIEW_PROMPT_VERSION } from "./prompts/review.v1";
import type { MentorFallbackReason } from "./protocol";
import {
  defaultLog,
  jsonFallbackResponse,
  jsonResponse,
  modelAvailable,
  readJsonBody,
  truncateForLog,
  type LogBase,
  type MentorLog,
} from "./respond";
import { MentorReviewSchema, REVIEW_LIMITS, type MentorReview } from "./review";
import { buildReviewPrompt } from "./review-prompt";
import { parseMentorReviewRequest } from "./schema";
import { validateMentorOutput } from "./validate";

/**
 * The debrief review handler (docs/plan/14-mentor.md §Spec): POST /api/mentor/review. Stateless,
 * like the other mentor routes, with the same body cap, delimiting and metadata-only log line.
 *
 * Vendored from `../hacker-simulation/src/features/mentor/review-handler.ts` (VENDORED.md): it
 * takes a `MentorCase`, and the review it checks has one more part, `custody`.
 *
 * Unlike a hint, the review is read whole before anything is sent: it's a small JSON object, and
 * every sentence in it must pass the same output validation as a hint before the player sees a
 * word. The answer is JSON — `{ mode: "model", review }` or `{ mode: "fallback", reason }` — and on
 * a fallback the browser shows the template review built from the run's facts.
 */

export interface HandleReviewDeps {
  readonly config: MentorConfig;
  readonly getCase: (id: string) => MentorCase | undefined;
  readonly runner?: MentorModelRunner;
  readonly log?: MentorLog;
}

export type ReviewCheck =
  | { readonly ok: true; readonly review: MentorReview }
  | { readonly ok: false; readonly reason: MentorFallbackReason };

/**
 * Checks what the model wrote: it must be the review's JSON shape, every sentence must pass the
 * output validation, and lesson suggestions must come from the case's own lessons (others are
 * dropped). Lists are cut to what the page shows.
 */
export function checkReviewOutput(text: string, allowedLessonIds: readonly string[]): ReviewCheck {
  if (text.trim() === "") return { ok: false, reason: "empty_output" };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: "unreadable_output" };
  }
  const parsed = MentorReviewSchema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: "unreadable_output" };
  const raw = parsed.data;

  const sentences = [
    raw.wellDone,
    raw.approach,
    raw.custody,
    raw.signOff,
    ...raw.efficientSteps,
    ...raw.detours,
    ...raw.tryNext.map((lesson) => lesson.why),
  ];
  if (sentences.some((sentence) => !validateMentorOutput(sentence).ok)) {
    return { ok: false, reason: "validation_rejected" };
  }

  const allowed = new Set(allowedLessonIds);
  const seen = new Set<string>();
  const tryNext = raw.tryNext.filter((lesson) => {
    if (!allowed.has(lesson.lessonId) || seen.has(lesson.lessonId)) return false;
    seen.add(lesson.lessonId);
    return true;
  });

  return {
    ok: true,
    review: {
      wellDone: raw.wellDone,
      approach: raw.approach,
      custody: raw.custody,
      efficientSteps: raw.efficientSteps.slice(0, REVIEW_LIMITS.efficientSteps),
      detours: raw.detours.slice(0, REVIEW_LIMITS.detours),
      tryNext: tryNext.slice(0, REVIEW_LIMITS.tryNext),
      signOff: raw.signOff,
    },
  };
}

export async function handleReviewRequest(
  request: Request,
  deps: HandleReviewDeps,
): Promise<Response> {
  const { config, getCase } = deps;
  const log = deps.log ?? defaultLog;
  const base: LogBase = { kind: "review", promptVersion: REVIEW_PROMPT_VERSION };

  const body = await readJsonBody(request);
  if (!body.ok) return jsonFallbackResponse(body.reason, body.status, log, base);
  const parsed = parseMentorReviewRequest(body.data);
  if (!parsed.ok) return jsonFallbackResponse("invalid_request", 400, log, base);
  const known: LogBase = { ...base, caseId: parsed.request.caseId };

  const caseView = getCase(parsed.request.caseId);
  if (!caseView) return jsonFallbackResponse("unknown_target", 404, log, known);
  const built = buildReviewPrompt(caseView, parsed.request);

  const runner = deps.runner;
  if (!modelAvailable(config, runner)) {
    return jsonFallbackResponse("disabled", 200, log, { ...known, model: config.model });
  }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REVIEW_TIMEOUT_MS);
  let full = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let check: ReviewCheck;
  try {
    const run = runner(
      {
        model: config.model,
        system: built.prompt.system,
        messages: built.prompt.messages,
        maxTokens: MAX_REVIEW_OUTPUT_TOKENS,
        jsonSchema: REVIEW_JSON_SCHEMA,
      },
      abort.signal,
    );
    for await (const delta of run) full += delta;
    try {
      const usage = await run.usage();
      inputTokens = usage.inputTokens;
      outputTokens = usage.outputTokens;
    } catch {
      // Usage is best-effort.
    }
    check = checkReviewOutput(full, built.lessonIds);
  } catch {
    check = { ok: false, reason: "model_error" };
  } finally {
    clearTimeout(timer);
  }

  const rejected = !check.ok && check.reason === "validation_rejected";
  log({
    feature: "mentor",
    ...known,
    promptVersion: built.prompt.version,
    model: config.model,
    inputTokens,
    outputTokens,
    fallback: !check.ok,
    ...(!check.ok && { fallbackReason: check.reason }),
    validationRejected: rejected,
    ...(rejected ? { rejectedText: truncateForLog(full) } : {}),
  });

  return check.ok
    ? jsonResponse({ mode: "model", review: check.review }, "model")
    : jsonResponse({ mode: "fallback", reason: check.reason }, "fallback");
}
