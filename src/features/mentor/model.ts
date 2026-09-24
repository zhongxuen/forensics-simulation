/**
 * The seam between the mentor handler and the model (docs/plan/14-mentor.md). The
 * handler depends on this interface, not on the Anthropic SDK, so it is fully testable with a mock
 * runner and never touches the network in tests. The real runner (which imports the SDK) lives in
 * `anthropic-client.ts` and is wired in only by the route.
 */

export interface MentorModelInput {
  readonly model: string;
  readonly system: string;
  readonly messages: readonly { readonly role: "user"; readonly content: string }[];
  readonly maxTokens: number;
  /**
   * Constrains the answer to this JSON schema (structured outputs). Only the debrief review
   * uses it; hints and explanations are plain text.
   */
  readonly jsonSchema?: Readonly<Record<string, unknown>>;
}

export interface MentorModelUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * A run of the model: an async iterable of text chunks, plus `usage()` which resolves once the run
 * has finished (used for the token counts in the log line). Iterating may throw on a model error or
 * a timeout/abort; the handler catches that and falls back.
 */
export interface MentorModelStream extends AsyncIterable<string> {
  usage(): Promise<MentorModelUsage>;
}

/** Starts a model run. The `signal` aborts it (timeout or client disconnect). */
export type MentorModelRunner = (input: MentorModelInput, signal: AbortSignal) => MentorModelStream;
