/**
 * Helpers the Linux commands share: reading their input (files, or text piped in), wording
 * filesystem errors the way each real tool does, and small formatting jobs.
 */
import { errorLine, errorLineText, failure, splitLines } from "../../core/output";
import { fsMessage, type FsError, type SimError } from "../../core/errors";
import { sessionFs, sessionHost } from "../../core/session";
import type { OutputLine, SimEvent, SimResult, SimState } from "../../core/types";
import { readFile, stat } from "../../fs/ops";
import type { ToolContext } from "../types";

/** Error details that already read well in the standard wording. */
const SPECIAL_DETAILS = new Set([
  "dot-path",
  "into-itself",
  "omit-directory",
  "unknown-user",
  "unknown-group",
]);

/**
 * A filesystem error the way a particular tool words it. With a verb: "rm: cannot remove 'x': No
 * such file or directory". Without: "cat: x: No such file or directory".
 */
export function fsErrorLine(tool: string, error: FsError, verb?: string): OutputLine {
  if (error.detail && SPECIAL_DETAILS.has(error.detail)) return errorLine(tool, error);
  const text = verb
    ? `${tool}: ${verb} '${error.path}': ${fsMessage(error.code)}`
    : `${tool}: ${error.path}: ${fsMessage(error.code)}`;
  return errorLineText(text, error);
}

/** A failed command with one filesystem error line. Exit status 1. */
export function fsFailure(tool: string, error: FsError, state: SimState, verb?: string): SimResult {
  return { state, output: [fsErrorLine(tool, error, verb)], events: [], exitCode: 1 };
}

/** A usage problem: the error line plus "Try '<tool> --help'". Exit status 2. */
export const usage = (tool: string, error: SimError, state: SimState): SimResult =>
  failure(tool, error, state);

export const extraArgument = (tool: string, value: string, state: SimState): SimResult =>
  usage(
    tool,
    { code: "BAD_ARGUMENT", argument: "argument", value, reason: "extra-argument" },
    state,
  );

/** One input to a text command: a file's content, or text piped in. */
export interface TextInput {
  /** The name as typed, or "(standard input)". */
  readonly name: string;
  readonly text: string;
}

export interface ReadInputs {
  /** Every input in the order named: its text, or the error line for a file that couldn't be read. */
  readonly items: readonly (TextInput | { readonly error: OutputLine })[];
  /** The inputs that could be read, in order. */
  readonly inputs: readonly TextInput[];
  /** Error lines for files that couldn't be read. The others are still used. */
  readonly errors: readonly OutputLine[];
  readonly events: readonly SimEvent[];
}

export const STDIN_NAME = "(standard input)";

/**
 * Reads a text command's inputs: each named file in order (`-` means the piped-in text), or the
 * piped-in text when no file is named. Every file read emits a `file.read` event with its real
 * path. Returns undefined when there's nothing to read at all: no file named and nothing piped.
 */
export function readInputs(
  tool: string,
  files: readonly string[],
  state: SimState,
  ctx: ToolContext,
): ReadInputs | undefined {
  if (files.length === 0) {
    if (ctx.stdin === undefined) return undefined;
    const input = { name: STDIN_NAME, text: ctx.stdin };
    return { items: [input], inputs: [input], errors: [], events: [] };
  }
  const { vfs, ctx: fsCtx } = sessionFs(state, ctx.now);
  const hostId = sessionHost(state).id;
  const items: (TextInput | { error: OutputLine })[] = [];
  const events: SimEvent[] = [];
  for (const file of files) {
    if (file === "-") {
      items.push({ name: STDIN_NAME, text: ctx.stdin ?? "" });
      continue;
    }
    const read = readFile(vfs, fsCtx, file);
    if (!read.ok) {
      items.push({ error: fsErrorLine(tool, read.error) });
      continue;
    }
    items.push({ name: file, text: read.value });
    const info = stat(vfs, fsCtx, file);
    if (info.ok) events.push({ type: "file.read", hostId, path: info.value.path });
  }
  return {
    items,
    inputs: items.filter((item): item is TextInput => "text" in item),
    errors: items.flatMap((item) => ("error" in item ? [item.error] : [])),
    events,
  };
}

/** The result for a text command that needs a file and got neither a name nor piped text. */
export const missingFile = (tool: string, state: SimState): SimResult =>
  usage(tool, { code: "MISSING_ARGUMENT", argument: "file operand" }, state);

export { splitLines };

/** Lines back into text with a final newline, the way files usually end. */
export const joinLines = (lines: readonly string[]): string =>
  lines.length === 0 ? "" : `${lines.join("\n")}\n`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SIX_MONTHS_MS = 182 * 86_400_000;

const two = (n: number) => String(n).padStart(2, "0");

/** A time the way `ls -l` shows it: "Mar  2 09:00", or "Mar  2  2025" if it's over six months off. */
export function lsTime(ms: number, now: number): string {
  const date = new Date(ms);
  const day = String(date.getUTCDate()).padStart(2, " ");
  const month = MONTHS[date.getUTCMonth()] ?? "";
  if (Math.abs(now - ms) > SIX_MONTHS_MS) {
    return `${month} ${day}  ${date.getUTCFullYear()}`;
  }
  return `${month} ${day} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
}

/** A time the way `date` shows it: "Mon Mar  2 09:00:05 UTC 2026". */
export function longTime(ms: number): string {
  const date = new Date(ms);
  return [
    DAYS[date.getUTCDay()],
    MONTHS[date.getUTCMonth()],
    String(date.getUTCDate()).padStart(2, " "),
    `${two(date.getUTCHours())}:${two(date.getUTCMinutes())}:${two(date.getUTCSeconds())}`,
    "UTC",
    date.getUTCFullYear(),
  ].join(" ");
}

/** A time the way `stat` shows it: "2026-03-02 09:00:00.000000000 +0000". */
export function statTime(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${two(date.getUTCMonth() + 1)}-${two(date.getUTCDate())} ${two(
    date.getUTCHours(),
  )}:${two(date.getUTCMinutes())}:${two(date.getUTCSeconds())}.000000000 +0000`;
}

export { MONTHS, DAYS };

/** Sizes like `ls -h`: 512, 4.0K, 1.2M. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return String(bytes);
  const units = ["K", "M", "G"];
  let value = bytes;
  let unit = "";
  for (const next of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return value < 10
    ? `${(Math.ceil(value * 10) / 10).toFixed(1)}${unit}`
    : `${Math.ceil(value)}${unit}`;
}

/** Parses a non-negative whole number option, or undefined. */
export function wholeNumber(text: string | undefined, max = 1_000_000): number | undefined {
  if (text === undefined || !/^\d{1,7}$/.test(text)) return undefined;
  const value = Number(text);
  return value <= max ? value : undefined;
}
