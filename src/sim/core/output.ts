/** Small builders for tool results, so every tool reports success and failure the same way. */
import { exitCodeFor, formatError, isUsageError, type SimError } from "./errors";
import type { OutputLine, SimEvent, SimResult, SimState } from "./types";

export const stdout = (text: string): OutputLine => ({ stream: "stdout", text });

export const stderr = (text: string): OutputLine => ({ stream: "stderr", text });

/** The realistic error line, with the typed error attached for the explainer layer. */
export const errorLine = (tool: string, error: SimError): OutputLine => ({
  stream: "stderr",
  text: formatError(tool, error),
  error,
});

/**
 * An error line worded the way one particular tool words it ("ls: cannot access 'x': ..."), still
 * carrying the typed error, so the explainer layer doesn't depend on the wording.
 */
export const errorLineText = (text: string, error: SimError): OutputLine => ({
  stream: "stderr",
  text,
  error,
});

export function success(
  state: SimState,
  output: readonly OutputLine[],
  events: readonly SimEvent[] = [],
): SimResult {
  return { state, output, events, exitCode: 0 };
}

/** A failed command. Usage errors get the usual "Try '<tool> --help'" pointer. */
export function failure(
  tool: string,
  error: SimError,
  state: SimState,
  events: readonly SimEvent[] = [],
): SimResult {
  const output = [errorLine(tool, error)];
  if (isUsageError(error)) output.push(stderr(`Try '${tool} --help' for more information.`));
  return { state, output, events, exitCode: exitCodeFor(error) };
}

/** Pads cells into aligned columns. The last column is never padded. */
export function columns(rows: readonly (readonly string[])[], gap = 2): string[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => (widths[i] = Math.max(widths[i] ?? 0, cell.length)));
  }
  return rows.map((row) =>
    row
      .map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd((widths[i] ?? 0) + gap)))
      .join(""),
  );
}

/** A command line for display: words with spaces or quotes are single-quoted, like a shell would need. */
export function formatArgv(argv: readonly string[]): string {
  return argv
    .map((word) =>
      word.length > 0 && /^[A-Za-z0-9_./:=,@%+-]+$/.test(word)
        ? word
        : `'${word.replace(/'/g, `'\\''`)}'`,
    )
    .join(" ");
}

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/** A file's lines, without the empty "line" after a final newline. */
export function splitLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}
