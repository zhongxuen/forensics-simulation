/**
 * The mentor feature's client-safe public API (docs/plan/14-mentor.md). Noor gives hints, never
 * answers, explains what's on the player's screen, and looks back at a finished case. Hints never
 * cost anything.
 *
 * **Nothing here imports the Anthropic SDK or any API key**: model calls go through the server
 * routes under /api/mentor, whose code lives behind `@/features/mentor/server`. This file may
 * safely land in a client bundle, and `pnpm security:bundle` proves it does so cleanly.
 */
export {
  EXPLAIN_VIEW_LABELS,
  HINT_COOLDOWN_MS,
  HINT_TIER_LABELS,
  HINT_TIERS,
  isNextTierUnlocked,
  MENTOR_ENDPOINTS,
  nextTierUnlockTime,
  subjectView,
  type ExplainSubject,
  type ExplainView,
  type HintTier,
  type MentorHintResult,
  type MentorKind,
  type MentorMode,
  type MentorTextResult,
} from "./protocol";
export {
  buildMentorTranscript,
  capTranscript,
  HINT_TRANSCRIPT_LIMITS,
  MAX_TRANSCRIPT_COMMANDS,
  REVIEW_TRANSCRIPT_LIMITS,
  type MentorTranscript,
  type MentorTranscriptEntry,
  type TranscriptLimits,
} from "./transcript";
export {
  authoredHint,
  requestMentorExplain,
  requestMentorHint,
  requestMentorReview,
  type MentorCaseRef,
  type RequestMentorExplainOptions,
  type RequestMentorHintOptions,
  type RequestMentorReviewOptions,
} from "./client";
export {
  buildFallbackReview,
  commandNames,
  custodySentence,
  MentorReviewSchema,
  REVIEW_LIMITS,
  runFactLines,
  type MentorReview,
  type MentorReviewLesson,
  type MentorReviewResult,
  type ReviewCustodyFacts,
  type ReviewFacts,
  type ReviewObjectiveFact,
  type RunFactLine,
} from "./review";
export {
  canRevealHint,
  createMentorStore,
  hintsFor,
  initialMentorState,
  MAX_EXPLANATIONS,
  nextHintTier,
  nextHintUnlockAt,
  questionView,
  questionViewLabel,
  staticMentorSession,
  type ExplainQuestion,
  type ExplainRequest,
  type MentorDeps,
  type MentorExplanation,
  type MentorHintEntry,
  type MentorReply,
  type MentorReplyStatus,
  type MentorReviewState,
  type MentorSession,
  type MentorState,
  type MentorStore,
} from "./session/mentor-store";
export { useMentorSession } from "./session/use-mentor-session";
export {
  NUDGE_FAILED_ATTEMPTS,
  NUDGE_IDLE_MS,
  seemsStuck,
  useNudge,
  type Nudge,
  type NudgeSignals,
  type UseNudgeOptions,
} from "./nudge";

export {
  FROM_NOTES_LABEL,
  MENTOR_FIRST_NAME,
  MENTOR_SPEAKER,
  MentorBubble,
} from "./components/mentor-bubble";
export {
  HINTS_ARE_FREE,
  MENTOR_WELCOME,
  MentorPanel,
  questionSummary,
  type MentorPanelCase,
  type MentorPanelObjective,
  type MentorPanelProps,
} from "./components/mentor-panel";
export { MentorReviewCard, type MentorReviewCardProps } from "./components/mentor-review";
export { MentorText, plainMentorText } from "./components/mentor-text";
export { NudgeChip } from "./components/nudge-chip";
export { TypingIndicator } from "./components/typing-indicator";
