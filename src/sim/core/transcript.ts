/**
 * Plain-text transcripts of a replay: each command, its output, its exit code and its events.
 * Used by golden tests, bug reports, and (in phase 10) as the mentor's view of a session. Colour
 * codes are left out, like copying text from a terminal.
 */
import { stripAnsi } from "./ansi";
import { formatArgv } from "./output";
import type { ReplayStep } from "./replay";
import { stableStringify } from "./stable-json";

export function renderTranscript(steps: readonly ReplayStep[]): string {
  const lines: string[] = [];
  for (const { command, output, events, exitCode } of steps) {
    const typed = command.type === "shell" ? command.line : formatArgv(command.argv);
    lines.push(`$ ${typed}`.trimEnd());
    if (command.type === "exec" && command.stdin !== undefined)
      lines.push(`  (with ${command.stdin.length} characters piped in)`);
    // Trailing spaces are trimmed so editors can't silently change a committed golden file.
    for (const line of output)
      lines.push(`${line.stream === "stderr" ? "!" : " "} ${stripAnsi(line.text)}`.trimEnd());
    lines.push(`[exit ${exitCode}]`);
    for (const { type, ...fields } of events) lines.push(`  @ ${type} ${stableStringify(fields)}`);
    lines.push("");
  }
  return lines.join("\n");
}
