import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { printFiles } from "./cat";
import { usage } from "./shared";

const NAME = "less";

export const less: Tool = {
  name: NAME,
  category: "read",
  help: {
    oneLiner: "read a long file comfortably, one screen at a time.",
    usage: ["less [options] file..."],
    description: [
      "On a real computer, less opens a file in a viewer you can scroll: the arrow keys and Page Up / Page Down move through it, / searches, and q quits back to the terminal. It's handy for files too long to fit on the screen.",
      "In this practice terminal, less shows the whole file at once and you scroll the terminal itself, so there's nothing to quit. Everything else about it is the same as cat.",
    ],
    options: [{ flags: "-N, --LINE-NUMBERS", text: "Number every line." }],
    examples: [
      { command: "less /var/log/syslog", text: "Read the system log." },
      { command: "less -N notes.txt", text: "Read notes.txt with line numbers." },
    ],
    concept: [
      "Logs and settings files can run to thousands of lines. Investigators read them in a viewer like less so they can move around and search without flooding the screen.",
      "A viewer only reads: it can't change the file. When you're looking at evidence, that's what you want.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [{ names: ["-N", "--LINE-NUMBERS"], key: "number" }]);
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
