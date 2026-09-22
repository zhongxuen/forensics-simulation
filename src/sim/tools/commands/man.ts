import { columns, errorLine, errorLineText, stdout, success } from "../../core/output";
import { renderManPage } from "../help";
import { optionValue, parseArgs } from "../args";
import type { Tool } from "../types";
import { extraArgument, usage } from "./shared";

const NAME = "man";

export const man: Tool = {
  name: NAME,
  category: "help",
  help: {
    oneLiner:
      "open the manual page for a command: what it does, how to use it, and why it matters.",
    usage: ["man command", "man -k word"],
    description: [
      "Every command has a manual page, or man page. It starts with a one-line summary (NAME), then how to type it (SYNOPSIS: square brackets mean optional, and ... means you can give more than one), what it does (DESCRIPTION), its options, some examples, and a CONCEPT section on why it matters in security work.",
      "Not sure which command you need? man -k searches every page's summary for a word: man -k file lists commands to do with files.",
    ],
    options: [{ flags: "-k <word>", text: "Search the one-line summaries of every page." }],
    examples: [
      { command: "man ls", text: "Read the manual for ls." },
      { command: "man -k network", text: "Find the commands to do with networks." },
      { command: "man man", text: "Read about man itself." },
    ],
    concept: [
      "Professionals look things up all the time: nobody remembers every option of every command. Knowing how to read a manual is more useful than memorising one.",
      "Manuals also warn you. Many options that delete or overwrite things are explained there first, and a minute of reading can save an afternoon of repairs.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-k", "--apropos"], key: "search", takesValue: true },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const search = optionValue(parsed.value, "search");
    if (search !== undefined) {
      const word = search.toLowerCase();
      const rows = ctx.registry.names().flatMap((name) => {
        const tool = ctx.registry.get(name);
        if (!tool) return [];
        const text = `${name} ${tool.help.oneLiner}`.toLowerCase();
        return text.includes(word) ? [[`${name} (1)`, `- ${tool.help.oneLiner}`]] : [];
      });
      if (rows.length === 0) {
        return {
          state,
          output: [stdout(`${search}: nothing appropriate.`)],
          events: [],
          exitCode: 16,
        };
      }
      return success(state, columns(rows, 1).map(stdout));
    }
    const [topic, extra] = parsed.value.positionals;
    if (topic === undefined) {
      return {
        state,
        output: [
          errorLineText("What manual page do you want?", {
            code: "MISSING_ARGUMENT",
            argument: "page",
          }),
          stdout("For example, try 'man man'."),
        ],
        events: [],
        exitCode: 1,
      };
    }
    if (extra !== undefined) return extraArgument(NAME, extra, state);
    const tool = ctx.registry.get(topic);
    if (!tool) {
      return {
        state,
        output: [errorLine(NAME, { code: "NO_MANUAL_ENTRY", topic })],
        events: [],
        exitCode: 16,
      };
    }
    return success(state, renderManPage(tool.name, tool.help), [
      { type: "help.viewed", command: tool.name },
    ]);
  },
};
