import type { MentorCase } from "./case-view";
import { MAX_OUTPUT_TOKENS, type MentorConfig } from "./config";
import type { MentorModelRunner } from "./model";
import { buildHintPrompt } from "./prompt-builder";
import { HINT_PROMPT_VERSION } from "./prompts/hint.v1";
import type { MentorFallbackReason } from "./protocol";
import {
  defaultLog,
  modelAvailable,
  readJsonBody,
  streamFallbackResponse,
  streamModelText,
  type LogBase,
  type MentorLog,
  type MentorLogEntry,
} from "./respond";
import { parseMentorHintRequest } from "./schema";

/**
 * The mentor hint handler (docs/plan/14-mentor.md). The route calls this; it holds no state between
 * requests. Everything it needs is injected, so the tests run it with a mock model runner and never
 * touch the network.
 *
 * Vendored from `../hacker-simulation/src/features/mentor/handler.ts` (VENDORED.md). The one change
 * that matters: `getCase` hands back a `MentorCase`, the answer-key-free projection (case-view.ts),
 * not a whole case. The handler never holds a report answer, an accepted ref, an objective's check
 * or the story's ground truth, because none of them is on the type it is given.
 *
 * It streams newline-delimited JSON (`text` / `done` / `fallback`), and the `x-mentor-mode` response
 * header says `model` or `fallback`. Nothing ever surfaces to the player as an error: a missing key,
 * the kill switch, a bad request, an unknown target, a model failure, a rejected response, or an
 * over-cap body all end the same way — a `fallback` event, and the client shows the authored hint.
 * The streaming, validation and logging it shares with the other two live in respond.ts.
 */

export type { MentorLogEntry };

export interface HandleHintDeps {
  readonly config: MentorConfig;
  /** The case, already projected down to what the mentor may see. */
  readonly getCase: (id: string) => MentorCase | undefined;
  /** The model runner. Omit only when the config has no key or is disabled (no model call is made). */
  readonly runner?: MentorModelRunner;
  readonly log?: MentorLog;
}

export async function handleHintRequest(request: Request, deps: HandleHintDeps): Promise<Response> {
  const { config, getCase } = deps;
  const log = deps.log ?? defaultLog;
  const base: LogBase = { kind: "hint", promptVersion: HINT_PROMPT_VERSION };

  // 1. Body-size cap, then parse and validate the request (the transcript is capped in the schema).
  const body = await readJsonBody(request);
  if (!body.ok) return streamFallbackResponse(body.reason, body.status, log, base);
  const parsed = parseMentorHintRequest(body.data);
  if (!parsed.ok || !parsed.request) {
    return streamFallbackResponse("invalid_request", 400, log, base);
  }
  const { caseId, objectiveId, tier, transcript } = parsed.request;
  const known: LogBase = { ...base, caseId, objectiveId, tier };

  // 2. Load the authored tier from the case content — never from the request. An unknown case,
  //    objective or tier, or a secret (which ships no hints, and must not be confirmed to exist),
  //    is a 4xx the client treats as a fallback.
  const caseView = getCase(caseId);
  if (!caseView) return streamFallbackResponse("unknown_target", 404, log, known);
  const built = buildHintPrompt(caseView, objectiveId, tier, transcript);
  if (!built.ok) {
    const reason: MentorFallbackReason =
      built.problem === "no_hints" ? "no_hints" : "unknown_target";
    return streamFallbackResponse(reason, 404, log, known);
  }

  // 3. Kill switch or no key: fall back cleanly. Nothing reveals which.
  if (!modelAvailable(config, deps.runner)) {
    return streamFallbackResponse("disabled", 200, log, { ...known, model: config.model });
  }

  // 4. Call the model, validating before releasing, and log exactly once when it ends.
  return streamModelText({
    config,
    runner: deps.runner,
    prompt: built.prompt,
    maxTokens: MAX_OUTPUT_TOKENS,
    log,
    base: { ...known, promptVersion: built.prompt.version },
  });
}

export { MAX_OUTPUT_TOKENS };
