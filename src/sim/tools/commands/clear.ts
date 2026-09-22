import { CLEAR_SCREEN } from "../../core/ansi";
import { stdout, success } from "../../core/output";
import { parseArgs } from "../args";
import type { Tool } from "../types";
import { extraArgument, usage } from "./shared";

const NAME = "clear";

export const clear: Tool = {
  name: NAME,
  category: "help",
  help: {
    oneLiner: "wipe the terminal screen clean, so you can start fresh.",
    usage: ["clear"],
    description: [
      "clear empties the screen and puts the prompt back at the top. Nothing on the computer changes: your files, and your command history, are all still there.",
      "Pressing Ctrl+L does the same thing.",
    ],
    examples: [{ command: "clear", text: "Clear the screen." }],
    concept: [
      "A tidy screen helps you focus on one step at a time. Before sharing your screen or taking a screenshot for a report, clearing it also stops you showing something you didn't mean to, like a password you typed earlier.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, []);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const [extra] = parsed.value.positionals;
    if (extra !== undefined) return extraArgument(NAME, extra, state);
    // The same escape codes a real `clear` prints; the terminal clears when it sees them.
    return success(state, [stdout(CLEAR_SCREEN)]);
  },
};
