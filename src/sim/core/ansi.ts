/**
 * Terminal colour codes (ANSI escape sequences), used the way real tools use them: `ls` colours
 * folders and `grep` highlights matches, but only when the output goes straight to the screen
 * (ToolContext.tty). The terminal turns them into styled text once, when a line arrives.
 */

const ESC = "\x1b[";

/** The codes tools use. Each wraps text as `${code}text${RESET}`. */
export const SGR = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  /** Folders, like GNU ls. */
  directory: `${ESC}01;34m`,
  /** Symbolic links. */
  symlink: `${ESC}01;36m`,
  /** Programs you can run. */
  executable: `${ESC}01;32m`,
  /** grep: the matching text. */
  match: `${ESC}01;31m`,
  /** grep: file names and line numbers. */
  fileName: `${ESC}35m`,
  lineNumber: `${ESC}32m`,
  separator: `${ESC}36m`,
} as const;

/** Clears the screen and moves to the top, like `clear`. */
export const CLEAR_SCREEN = `${ESC}H${ESC}2J${ESC}3J`;

export const paint = (code: string, text: string): string => `${code}${text}${SGR.reset}`;

// Any CSI sequence: ESC [ parameters, then one final letter.
const CSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

/** The text without colour or cursor codes: what the learner actually reads. */
export function stripAnsi(text: string): string {
  return text.includes("\x1b") ? text.replace(CSI, "") : text;
}
