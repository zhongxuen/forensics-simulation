import { stdout } from "../../core/output";
import type { OutputLine, SimResult, SimState } from "../../core/types";
import { hasSwitch, parseArgs } from "../args";
import type { Tool, ToolContext } from "../types";
import { missingFile, readInputs, splitLines, usage } from "./shared";

const NAME = "cat";

/** What cat and less both do: print files one after another, optionally numbering the lines. */
export function printFiles(
  tool: string,
  files: readonly string[],
  numbered: boolean,
  state: SimState,
  ctx: ToolContext,
): SimResult {
  const read = readInputs(tool, files, state, ctx);
  if (!read) return missingFile(tool, state);
  const output: OutputLine[] = [];
  let number = 0;
  // Errors show where they happened: after the files before them, before the files after.
  for (const item of read.items) {
    if ("error" in item) {
      output.push(item.error);
      continue;
    }
    for (const line of splitLines(item.text)) {
      number++;
      output.push(stdout(numbered ? `${String(number).padStart(6)}  ${line}` : line));
    }
  }
  return { state, output, events: read.events, exitCode: read.errors.length > 0 ? 1 : 0 };
}

export const cat: Tool = {
  name: NAME,
  category: "read",
  help: {
    oneLiner: "show what's written inside a file, all at once.",
    usage: ["cat [options] [file...]"],
    description: [
      "cat prints a file's contents to the terminal. Give it several files and it prints them one after another: its name is short for concatenate, which means joining things end to end.",
      "It only works on files you're allowed to read. Folders can't be printed: use ls to see inside a folder.",
      "With no file name, cat reads text piped into it from another command, like `echo hello | cat`.",
    ],
    options: [{ flags: "-n, --number", text: "Number every line." }],
    examples: [
      { command: "cat notes.txt", text: "Show what's in notes.txt." },
      {
        command: "cat -n /etc/passwd",
        text: "Show the list of accounts on this computer, with line numbers.",
      },
      { command: "cat .bashrc", text: "Read a hidden settings file." },
    ],
    concept: [
      "Reading files is most of what investigators do. Settings files, notes and logs often hold clues, and sometimes secrets: a password written into a file anyone can read is one of the most common real weaknesses.",
      "Some files are locked so only certain accounts can read them. /etc/shadow, which stores password hashes (scrambled passwords), is readable only by the admin account. If cat says Permission denied, a protection is working.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [{ names: ["-n", "--number"], key: "number" }]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    return printFiles(
      NAME,
      parsed.value.positionals,
      hasSwitch(parsed.value, "number"),
      state,
      ctx,
    );
  },
};
