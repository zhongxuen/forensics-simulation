import type { TerminalBlock, TerminalLine } from "../session/terminal-session";
import { explainBlock } from "./what-happened";

/**
 * "Explain this" on the terminal (md-files/10-ai-mentor.md, prompt 10.3): what the learner pointed
 * at, and the explanation the terminal already has for it. The terminal doesn't know who explains
 * (that's the mentor, wired in by the mission workspace); it hands over the text and a fallback
 * written ahead of time, so the learner always gets an answer, even with the mentor unavailable:
 *
 * - an error line: the beginner explainer printed under it (explain-error.ts), which says what
 *   happened, why, and what to try next;
 * - any other line, or everything a command printed: the "What just happened?" walk-through.
 */
export interface TerminalExplainRequest {
  /** The command line, as typed. */
  readonly command: string;
  /** The line pointed at, or everything the command printed (plain text, no colour codes). */
  readonly text: string;
  readonly scope: "line" | "output";
  /** Whether the line is an error message. */
  readonly error: boolean;
  /** The explanation written ahead of time, used verbatim if the mentor is unavailable. */
  readonly fallback: string;
}

/** The most lines offered to choose from, so the chooser stays short. */
export const MAX_EXPLAIN_CHOICES = 12;

const isError = (line: TerminalLine) => line.error !== undefined || line.stream === "stderr";

/** The walk-through as one paragraph of plain sentences (backticks kept for code). */
function whatHappenedText(block: TerminalBlock): string {
  const explanation = explainBlock(block);
  // Each command with what it does, then what its options did and how to read what it printed
  // ("Each row of a long listing reads: ..."), which is most of what explaining a line needs.
  const steps = explanation.steps.map((step) => {
    const summary = step.summary.replace(/\.?$/, ".");
    const details = step.details.map((detail) => detail.replace(/\.?$/, "."));
    return [`\`${step.name}\`: ${summary}`, ...details].join(" ");
  });
  return [...steps, ...explanation.joins, ...explanation.outcome].join(" ").trim();
}

/** The beginner explainer lines printed right under an error line. */
function explainerUnder(block: TerminalBlock, lineId: number): string {
  const index = block.lines.findIndex((line) => line.id === lineId);
  if (index === -1) return "";
  const texts: string[] = [];
  for (const line of block.lines.slice(index + 1)) {
    if (line.kind === "output") break;
    if (line.kind === "explain" && !line.pointer) texts.push(line.text);
  }
  return texts.join(" ");
}

/** Whether a block can be explained: something the learner typed. */
export function canExplainBlock(block: TerminalBlock): boolean {
  return block.kind === "command" && block.input.trim() !== "" && !block.interrupted;
}

/** The lines worth offering to explain: output with words in it, each distinct line once. */
export function explainableLines(block: TerminalBlock): TerminalLine[] {
  const seen = new Set<string>();
  const lines: TerminalLine[] = [];
  for (const line of block.lines) {
    if (line.kind !== "output") continue;
    const text = line.text.trim();
    if (text === "" || seen.has(text)) continue;
    seen.add(text);
    lines.push(line);
    if (lines.length >= MAX_EXPLAIN_CHOICES) break;
  }
  return lines;
}

/**
 * The request for one line of a block (by line id), or for everything it printed (no id). The
 * fallback always has words in it: an error's own explainer, or the walk-through.
 */
export function explainRequestFor(block: TerminalBlock, lineId?: number): TerminalExplainRequest {
  const line =
    lineId === undefined
      ? undefined
      : block.lines.find((candidate) => candidate.id === lineId && candidate.kind === "output");
  const walkThrough = whatHappenedText(block);

  if (line) {
    const error = isError(line);
    const explainer = error ? explainerUnder(block, line.id) : "";
    return {
      command: block.input,
      text: line.text,
      scope: "line",
      error,
      fallback: explainer !== "" ? explainer : walkThrough,
    };
  }

  const output = block.lines
    .filter((candidate) => candidate.kind === "output")
    .map((candidate) => candidate.text)
    .join("\n");
  return {
    command: block.input,
    text: output,
    scope: "output",
    error: block.lines.some((candidate) => candidate.kind === "output" && isError(candidate)),
    fallback: walkThrough,
  };
}
