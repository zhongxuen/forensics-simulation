import { errorLineText, stdout, success } from "../../core/output";
import { renderHelp } from "../help";
import { parseArgs } from "../args";
import { TOOL_CATEGORIES, TOOL_CATEGORY_LABELS, type ToolRegistry } from "../types";
import type { Tool } from "../types";
import { extraArgument, usage } from "./shared";

const NAME = "help";

/** The order commands are worth learning in, within each group. Anything unlisted goes last. */
const TEACHING_ORDER = [
  "pwd",
  "ls",
  "cd",
  "tree",
  "cat",
  "less",
  "head",
  "tail",
  "grep",
  "file",
  "stat",
  "touch",
  "mkdir",
  "cp",
  "mv",
  "rm",
  "echo",
  "wc",
  "sort",
  "uniq",
  "cut",
  "sed",
  "whoami",
  "id",
  "hostname",
  "uname",
  "ps",
  "env",
  "history",
  "date",
  "chmod",
  "chown",
  "sudo",
  "ping",
  "ifconfig",
  "netscan",
  "webprobe",
  "logview",
  "hashid",
  "help",
  "man",
  "clear",
  "exit",
];

/**
 * Every command, grouped by what a beginner wants to do: "Look around", "Read files", and so on.
 * Shared by bare `help` and the terminal's cheat sheet, so they always agree.
 */
export function commandGroups(
  registry: ToolRegistry,
): { readonly label: string; readonly commands: readonly string[] }[] {
  const rank = (name: string) => {
    const index = TEACHING_ORDER.indexOf(name);
    return index === -1 ? TEACHING_ORDER.length : index;
  };
  return TOOL_CATEGORIES.map((category) => ({
    label: TOOL_CATEGORY_LABELS[category],
    commands: registry
      .names()
      .filter((name) => registry.get(name)?.category === category)
      .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1)),
  })).filter((group) => group.commands.length > 0);
}

export const help: Tool = {
  name: NAME,
  category: "help",
  help: {
    oneLiner: "list the commands you can use here, grouped by what they're for.",
    usage: ["help", "help command"],
    description: [
      "help on its own lists every command in this terminal, grouped by what you might want to do: look around, read files, find things, and so on.",
      "help followed by a command's name shows a short guide to that command. For the full manual page, use man instead: man ls.",
    ],
    examples: [
      { command: "help", text: "Every command, grouped." },
      { command: "help grep", text: "A short guide to grep." },
    ],
    concept: [
      "Nobody starts out knowing the commands. Looking them up is a normal part of the job at every level, and reading what a command does before you run it is a good security habit in itself.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, []);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const [topic, extra] = parsed.value.positionals;
    if (extra !== undefined) return extraArgument(NAME, extra, state);
    if (topic !== undefined) {
      const tool = ctx.registry.get(topic);
      if (!tool) {
        return {
          state,
          output: [
            errorLineText(`bash: help: no help topics match '${topic}'.`, {
              code: "NO_MANUAL_ENTRY",
              topic,
            }),
          ],
          events: [],
          exitCode: 1,
        };
      }
      return success(state, renderHelp(tool.name, tool.help), [
        { type: "help.viewed", command: tool.name },
      ]);
    }
    const groups = commandGroups(ctx.registry);
    const width = Math.max(...groups.map((group) => group.label.length)) + 3;
    return success(state, [
      stdout("Here's what you can type. Pick a command, type it, and press Enter."),
      stdout("To learn more about one, type man and its name, like: man ls"),
      stdout(""),
      ...groups.map((group) =>
        stdout(`  ${group.label.padEnd(width)}${group.commands.join("  ")}`),
      ),
      stdout(""),
      stdout("Tips: Tab finishes a name for you. The up arrow brings back your last command."),
      stdout("Everything here is a practice computer, so nothing can break for real."),
    ]);
  },
};
