import { stdout } from "../../core/output";
import type { OutputLine, SimResult, SimState } from "../../core/types";
import { hasSwitch, optionValue, parseArgs } from "../args";
import type { Tool, ToolContext } from "../types";
import { missingFile, readInputs, splitLines, STDIN_NAME, usage, wholeNumber } from "./shared";

const NAME = "head";

/**
 * head and tail share everything but which end they keep. `-5` is short for `-n 5`, and tail
 * also takes `-n +5`: everything from line 5 on.
 */
export function headOrTail(
  tool: "head" | "tail",
  args: readonly string[],
  state: SimState,
  ctx: ToolContext,
): SimResult {
  const expanded = args.flatMap((arg) => (/^-\d+$/.test(arg) ? ["-n", arg.slice(1)] : [arg]));
  const parsed = parseArgs(expanded, [
    { names: ["-n", "--lines"], key: "lines", takesValue: true },
    { names: ["-c", "--bytes"], key: "bytes", takesValue: true },
    { names: ["-q", "--quiet", "--silent"], key: "quiet" },
    { names: ["-v", "--verbose"], key: "verbose" },
  ]);
  if (!parsed.ok) return usage(tool, parsed.error, state);

  const linesText = optionValue(parsed.value, "lines");
  const bytesText = optionValue(parsed.value, "bytes");
  const fromStart = tool === "tail" && (linesText ?? bytesText ?? "").startsWith("+");
  const countText = (linesText ?? bytesText)?.replace(/^\+/, "");
  const count = countText === undefined ? 10 : wholeNumber(countText);
  if (count === undefined) {
    return usage(
      tool,
      {
        code: "BAD_ARGUMENT",
        argument: bytesText !== undefined ? "number of bytes" : "number of lines",
        value: linesText ?? bytesText ?? "",
        reason: "bad-format",
      },
      state,
    );
  }

  const read = readInputs(tool, parsed.value.positionals, state, ctx);
  if (!read) return missingFile(tool, state);
  const headers =
    hasSwitch(parsed.value, "verbose") ||
    (!hasSwitch(parsed.value, "quiet") && read.items.length > 1);

  const output: OutputLine[] = [];
  read.items.forEach((item, i) => {
    if ("error" in item) {
      output.push(item.error);
      return;
    }
    if (headers) {
      if (i > 0) output.push(stdout(""));
      output.push(stdout(`==> ${item.name === STDIN_NAME ? "standard input" : item.name} <==`));
    }
    if (bytesText !== undefined) {
      const text =
        tool === "head"
          ? item.text.slice(0, count)
          : fromStart
            ? item.text.slice(Math.max(0, count - 1))
            : item.text.slice(Math.max(0, item.text.length - count));
      output.push(...splitLines(text).map(stdout));
      return;
    }
    // Piped-in lines keep the artefact ref they carried (docs/plan/07-carve-strings-logq.md).
    const refs = item.name === STDIN_NAME ? ctx.stdinRefs : undefined;
    const lines = splitLines(item.text).map((text, index) => ({ text, ref: refs?.[index] }));
    const kept =
      tool === "head"
        ? lines.slice(0, count)
        : fromStart
          ? lines.slice(Math.max(0, count - 1))
          : count === 0
            ? []
            : lines.slice(-count);
    output.push(...kept.map(({ text, ref }) => (ref ? { ...stdout(text), ref } : stdout(text))));
  });
  return { state, output, events: read.events, exitCode: read.errors.length > 0 ? 1 : 0 };
}

export const head: Tool = {
  name: NAME,
  category: "read",
  help: {
    oneLiner: "show the first few lines of a file, to peek at it without reading it all.",
    usage: ["head [options] [file...]"],
    description: [
      "head prints the beginning of a file: the first 10 lines, unless you ask for a different number with -n. It's a quick way to see what a file is and how it's laid out.",
      "With no file name, it reads text piped in from another command, so `ls -l | head -n 3` shows the first three lines of a folder listing.",
    ],
    options: [
      {
        flags: "-n, --lines <n>",
        text: "Show the first n lines. -n 5 and -5 mean the same thing.",
      },
      { flags: "-c, --bytes <n>", text: "Show the first n characters (bytes) instead." },
      { flags: "-q", text: "Don't print file names when showing several files." },
      { flags: "-v", text: "Always print the file name first." },
    ],
    examples: [
      { command: "head notes.txt", text: "The first 10 lines of notes.txt." },
      { command: "head -n 3 /etc/passwd", text: "The first 3 accounts on this computer." },
    ],
    concept: [
      "Files can be huge. Investigators peek at the top first to learn a file's format, like which column holds the date in a log, before deciding how to search it.",
      "Many files put their most important lines first: a script's first line says which program runs it, and a settings file often opens with a comment explaining it.",
    ],
  },

  run(args, state, ctx) {
    return headOrTail(NAME, args, state, ctx);
  },
};
