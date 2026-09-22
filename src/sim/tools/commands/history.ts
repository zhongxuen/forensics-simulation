import { stdout, success } from "../../core/output";
import { withSession } from "../../core/session";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { usage, wholeNumber } from "./shared";

const NAME = "history";

export const history: Tool = {
  name: NAME,
  category: "system",
  help: {
    oneLiner: "list the commands you've typed so far, numbered.",
    usage: ["history [n]", "history -c"],
    description: [
      "The terminal remembers the commands you run. history lists them with a number each, oldest first. Give it a number to see only the last few.",
      "You can also press the up arrow at the prompt to bring back earlier commands one at a time, and Ctrl+R to search them.",
    ],
    options: [{ flags: "-c", text: "Forget every command in the list." }],
    examples: [
      { command: "history", text: "Every command in this session." },
      { command: "history 5", text: "The last five commands." },
    ],
    concept: [
      "On a real computer, each account's shell history is saved in a hidden file (like ~/.bash_history). Investigators read it to learn what someone did, and it sometimes contains passwords people typed by mistake.",
      "That's why attackers often clear it, and why an empty history on a busy account is itself worth a second look.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, [{ names: ["-c"], key: "clear" }]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    if (hasSwitch(parsed.value, "clear")) return success(withSession(state, { history: [] }), []);
    const [countText] = parsed.value.positionals;
    const count = countText === undefined ? undefined : wholeNumber(countText);
    if (countText !== undefined && count === undefined) {
      return usage(
        NAME,
        { code: "BAD_ARGUMENT", argument: "number", value: countText, reason: "bad-format" },
        state,
      );
    }
    const all = state.session.history;
    const start = count === undefined ? 0 : Math.max(0, all.length - count);
    const lines = all
      .slice(start)
      .map((line, i) => stdout(`${String(start + i + 1).padStart(5)}  ${line}`));
    return success(state, lines);
  },
};
