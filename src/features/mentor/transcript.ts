import type { TerminalBlock } from "@/features/terminal";

/**
 * The mentor transcript: the player's recent commands and what the computer showed, sent to the
 * mentor routes so Noor can speak to what they actually tried (docs/plan/14-mentor.md, prompts
 * 10.1 and 10.4). It is the only player text that ever leaves the browser, and only when the
 * player asks the mentor for something: a hint, an explanation, or a look back at their run
 * (docs/plan/05-workspace-ui.md, "Sent, but not kept").
 *
 * It is untrusted, in two directions:
 *  - Forging it only changes the player's own answer (there is no account and nothing is stored),
 *    so it never needs authenticating.
 *  - It is always treated as data, never instructions: the prompt wraps it in a delimited block and
 *    the caps here (plus the server's body-size cap) keep it small and cheap.
 *
 * The same caps run on both sides: `buildMentorTranscript` trims client-side before sending, and the
 * request schemas trim again server-side, so the model never sees more than this regardless of what
 * a forged body contains. A hint looks at the last few commands in detail; the post-case review
 * looks at more commands, with less of each one's output.
 */

/** One command the player ran, and the output it produced, both already trimmed. */
export interface MentorTranscriptEntry {
  /** The command line the player typed. */
  readonly input: string;
  /** What the computer showed, without the beginner explainer lines or colour codes. */
  readonly output: string;
}

export type MentorTranscript = readonly MentorTranscriptEntry[];

/** How much of a transcript is kept. */
export interface TranscriptLimits {
  /** The most commands kept, newest first. */
  readonly commands: number;
  /** The longest any single line (a command, or one line of output) may be, in characters. */
  readonly lineChars: number;
  /** The most lines of output kept per command. */
  readonly outputLines: number;
  /** The most characters kept for one command's output, after the per-line caps. */
  readonly entryOutputChars: number;
  /** A hard cap on the whole transcript's characters, oldest commands dropped first. */
  readonly totalChars: number;
}

/** For a hint or an explanation: the last few commands, in detail. */
export const HINT_TRANSCRIPT_LIMITS: TranscriptLimits = {
  commands: 12,
  lineChars: 200,
  outputLines: 20,
  entryOutputChars: 1500,
  totalChars: 6000,
};

/** For the post-case review: more of the run, with only the start of each command's output. */
export const REVIEW_TRANSCRIPT_LIMITS: TranscriptLimits = {
  commands: 40,
  lineChars: 200,
  outputLines: 4,
  entryOutputChars: 300,
  totalChars: 8000,
};

export const MAX_TRANSCRIPT_COMMANDS = HINT_TRANSCRIPT_LIMITS.commands;
export const MAX_LINE_CHARS = HINT_TRANSCRIPT_LIMITS.lineChars;
export const MAX_OUTPUT_LINES = HINT_TRANSCRIPT_LIMITS.outputLines;
export const MAX_ENTRY_OUTPUT_CHARS = HINT_TRANSCRIPT_LIMITS.entryOutputChars;
export const MAX_TRANSCRIPT_CHARS = HINT_TRANSCRIPT_LIMITS.totalChars;

/** Cuts `text` to `max` characters, marking that it was shortened. */
function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/** One line, to a single line (no newlines) and the per-line character cap. */
export function trimLine(line: string, limits: TranscriptLimits = HINT_TRANSCRIPT_LIMITS): string {
  return truncate(line.replace(/[\r\n]+/g, " ").trimEnd(), limits.lineChars);
}

/** Output text, capped to a number of lines, per-line length, and a total. */
export function trimOutput(
  output: string,
  limits: TranscriptLimits = HINT_TRANSCRIPT_LIMITS,
): string {
  const lines = output
    .split("\n")
    .slice(0, limits.outputLines)
    .map((line) => trimLine(line, limits));
  const joined = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return truncate(joined, limits.entryOutputChars);
}

/** The number of characters an entry contributes, for the total cap. */
function entryChars(entry: MentorTranscriptEntry): number {
  return entry.input.length + entry.output.length;
}

/**
 * Applies the caps to a transcript: keeps the last few entries, trims each, then drops the oldest
 * while the total is over the character cap. Pure, so the server can run the exact same trimming.
 */
export function capTranscript(
  entries: MentorTranscript,
  limits: TranscriptLimits = HINT_TRANSCRIPT_LIMITS,
): MentorTranscriptEntry[] {
  const trimmed = entries
    .slice(-limits.commands)
    .map((entry) => ({
      input: trimLine(entry.input, limits),
      output: trimOutput(entry.output, limits),
    }))
    .filter((entry) => entry.input !== "");

  let total = trimmed.reduce((sum, entry) => sum + entryChars(entry), 0);
  while (trimmed.length > 1 && total > limits.totalChars) {
    const dropped = trimmed.shift();
    if (dropped) total -= entryChars(dropped);
  }
  // If one entry alone is still over the cap, its own field caps already bounded it.
  return trimmed;
}

/**
 * Turns the terminal's blocks into a capped transcript for the mentor. Only real command blocks
 * count (not the terminal's own notes), and the beginner explainer lines are dropped, so the model
 * sees what a plain terminal would show.
 */
export function buildMentorTranscript(
  blocks: readonly TerminalBlock[],
  limits: TranscriptLimits = HINT_TRANSCRIPT_LIMITS,
): MentorTranscriptEntry[] {
  const entries = blocks
    .filter((block) => block.kind === "command" && block.input.trim() !== "" && !block.interrupted)
    .map((block) => ({
      input: block.input,
      output: block.lines
        .filter((line) => line.kind !== "explain")
        .map((line) => line.text)
        .join("\n"),
    }));
  return capTranscript(entries, limits);
}
