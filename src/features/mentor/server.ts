/**
 * The mentor feature's server-only public API (docs/plan/14-mentor.md). It exposes the pieces the
 * routes under /api/mentor need — the case projection, the request schemas, prompt building, output
 * validation, the config, and the three handlers (hint, explain, review) — plus the SDK-backed
 * model runner.
 *
 * The Anthropic SDK and the API key are reached ONLY through `anthropic-client.ts`, whose module
 * carries `import "server-only"`. This barrel deliberately does not import "server-only" itself, so
 * the pure pieces (the projection, prompt building, validation, the schemas) stay unit-testable in
 * Node, while the key never has a path into a client bundle: `@/features/mentor` (the client API)
 * imports none of this.
 *
 * `toMentorCase` is the first thing a route calls: it projects a case down to the objectives and
 * their hints, so the answer key is never in scope for anything below it (case-view.ts).
 */
export { createAnthropicRunner, getAnthropicRunner } from "./anthropic-client";
export {
  askableObjective,
  toMentorCase,
  unlockedTiers,
  type MentorCase,
  type MentorCaseSource,
  type MentorObjective,
} from "./case-view";
export {
  DEFAULT_MENTOR_MODEL,
  MAX_EXPLAIN_OUTPUT_TOKENS,
  MAX_OUTPUT_TOKENS,
  MAX_REQUEST_BODY_BYTES,
  MAX_REVIEW_OUTPUT_TOKENS,
  MODEL_TIMEOUT_MS,
  readMentorConfig,
  REVIEW_TIMEOUT_MS,
  type MentorConfig,
} from "./config";
export { handleHintRequest, type HandleHintDeps } from "./handler";
export { handleExplainRequest, type HandleExplainDeps } from "./explain-handler";
export {
  checkReviewOutput,
  handleReviewRequest,
  type HandleReviewDeps,
  type ReviewCheck,
} from "./review-handler";
export { commandName, manPageFor } from "./man-page";
export type { MentorLogEntry } from "./respond";
export type {
  MentorModelInput,
  MentorModelRunner,
  MentorModelStream,
  MentorModelUsage,
} from "./model";
export {
  buildHintPrompt,
  HINT_PROMPT_VERSION,
  type BuildHintPromptResult,
  type HintPrompt,
} from "./prompt-builder";
export { buildExplainPrompt, type BuildExplainPromptResult } from "./explain-prompt";
export { buildReviewPrompt, knownCustodyKinds, type ReviewPromptBuild } from "./review-prompt";
export {
  buildHintSystemPrompt,
  buildHintUserMessage,
  TRANSCRIPT_CLOSE,
  TRANSCRIPT_OPEN,
} from "./prompts/hint.v1";
export { EXPLAIN_PROMPT_VERSION } from "./prompts/explain.v1";
export { REVIEW_JSON_SCHEMA, REVIEW_PROMPT_VERSION } from "./prompts/review.v1";
export {
  AUDIENCE,
  DATA_RULE,
  FORENSICS_RULE,
  neutralizePlayerTags,
  PERSONA,
  PLAYER_TAGS,
  SAFETY,
  SCREEN_CLOSE,
  SCREEN_OPEN,
  SELECTION_CLOSE,
  SELECTION_OPEN,
  VOICE,
} from "./prompts/noor.v1";
export {
  asHintTier,
  EXPLAIN_ROW_VIEWS,
  MentorExplainRequestSchema,
  MentorHintRequestSchema,
  MentorReviewRequestSchema,
  parseMentorExplainRequest,
  parseMentorHintRequest,
  parseMentorReviewRequest,
  type MentorExplainRequest,
  type MentorHintRequest,
  type MentorReviewRequest,
} from "./schema";
export { validateMentorOutput, type MentorValidationResult } from "./validate";
