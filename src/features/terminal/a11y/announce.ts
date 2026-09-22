/**
 * What the screen reader hears after each command (md-files/05-terminal-module.md,
 * "Accessibility"). Short output is read out in full; long output is summarised, with a pointer
 * to the scrollable output region, so a 200-line listing doesn't drown out everything else.
 */
import type { TerminalBlock } from "../session/terminal-session";

/** Up to this many lines are read out; more are summarised. */
export const MAX_ANNOUNCED_LINES = 6;
const MAX_ANNOUNCED_CHARS = 400;

/** Strips the `backticks` the explainer copy uses for emphasis. */
const plainCopy = (text: string) => text.replace(/`/g, "");

export function announceBlock(block: TerminalBlock, beginnerMode: boolean): string {
  const name = block.input.trim().split(/\s+/)[0] ?? "";
  if (block.interrupted) return "Line cancelled.";
  if (block.kind === "note") return block.lines.map((line) => line.text).join(" ");

  const explanations = beginnerMode
    ? block.lines
        .filter((line) => line.kind === "explain" && !line.pointer)
        .map((line) => plainCopy(line.text))
    : [];
  if (block.parseError) {
    return [`The line couldn't be read: ${block.parseError.message}.`, ...explanations].join(" ");
  }
  const output = block.lines.filter((line) => line.kind === "output");
  const failed = block.exitCode !== 0;
  const status =
    name === "" ? "" : failed ? `${name} finished with a problem.` : `${name} finished.`;
  if (output.length === 0) {
    return [status, "No output.", ...explanations].filter(Boolean).join(" ");
  }
  const text = output.map((line) => (line.error ? `Error: ${line.text}` : line.text)).join(". ");
  if (output.length <= MAX_ANNOUNCED_LINES && text.length <= MAX_ANNOUNCED_CHARS) {
    return [status, text, ...explanations].filter(Boolean).join(" ");
  }
  const errors = output.filter((line) => line.error).map((line) => `Error: ${line.text}`);
  return [
    status,
    `${output.length} lines of output. Press Shift+Tab to review them in the output area.`,
    ...errors.slice(0, 2),
    ...explanations.slice(0, 2),
  ]
    .filter(Boolean)
    .join(" ");
}
