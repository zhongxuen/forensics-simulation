import { stdout, success } from "../../core/output";
import { parseArgs } from "../args";
import type { Tool } from "../types";
import { extraArgument, usage } from "./shared";

const NAME = "pwd";

export const pwd: Tool = {
  name: NAME,
  category: "look-around",
  help: {
    oneLiner: "show which folder you're in right now, like the address bar of a file browser.",
    usage: ["pwd"],
    description: [
      "The terminal is always inside one folder, called the working directory (directory is another word for folder). pwd prints its full path: the list of folders from the very top of the computer down to where you are, separated by slashes, like /home/recruit.",
      "The top of every Linux computer is the root folder, written as a single /. Every other file and folder lives somewhere inside it.",
    ],
    options: [
      { flags: "-L", text: "Show the path as you reached it (the default here)." },
      { flags: "-P", text: "Show the real path, with any shortcuts (symbolic links) followed." },
    ],
    examples: [{ command: "pwd", text: "Print the folder you're in, such as /home/recruit." }],
    concept: [
      "Knowing exactly where you are stops mistakes. Deleting or changing a file in a folder you didn't mean to be in is one of the most common ways people break computers, so security teams check where they are before they touch anything.",
      "After getting into a computer, testers run pwd early to find out where they landed: a home folder, a web server's folder, or somewhere unexpected.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, [
      { names: ["-L"], key: "logical" },
      { names: ["-P"], key: "physical" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const [extra] = parsed.value.positionals;
    if (extra !== undefined) return extraArgument(NAME, extra, state);
    return success(state, [stdout(state.session.cwd)]);
  },
};
