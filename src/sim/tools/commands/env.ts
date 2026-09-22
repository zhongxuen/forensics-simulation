import { stdout, success } from "../../core/output";
import { compareNames } from "../../fs/tree";
import { parseArgs } from "../args";
import type { Tool } from "../types";
import { extraArgument, usage } from "./shared";

const NAME = "env";

export const env: Tool = {
  name: NAME,
  category: "system",
  help: {
    oneLiner: "list the terminal's variables: named settings like HOME and USER.",
    usage: ["env"],
    description: [
      "A variable is a name with a value, like HOME=/home/recruit. The terminal keeps a set of them, called environment variables, and programs read them to learn things: which account is running them (USER), where your home folder is (HOME), which folder you're in (PWD), and where to look for programs (PATH).",
      "Use a variable in a command by putting $ in front of its name: `echo $HOME` prints your home folder. Set one for the rest of the session with NAME=value (no spaces around the =).",
    ],
    examples: [
      { command: "env", text: "Every variable and its value." },
      { command: "env | grep HOME", text: "Only the HOME variable." },
    ],
    concept: [
      "Variables sometimes hold secrets. Programs are often given passwords or keys through variables, and anyone who can read them can read the secret. Checking for secrets in variables, and keeping them out, is part of securing a system.",
      "PATH decides which program runs when you type a name. If an attacker can put a folder they control early in PATH, they can make a harmless-looking command run their program instead.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, []);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const [extra] = parsed.value.positionals;
    if (extra !== undefined) return extraArgument(NAME, extra, state);
    const variables = { ...state.session.env, PWD: state.session.cwd };
    const lines = Object.keys(variables)
      .sort(compareNames)
      .map((name) => stdout(`${name}=${variables[name as keyof typeof variables]}`));
    return success(state, lines);
  },
};
