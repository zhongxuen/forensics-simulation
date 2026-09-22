import type { Tool } from "../types";
import { headOrTail } from "./head";

const NAME = "tail";

export const tail: Tool = {
  name: NAME,
  category: "read",
  help: {
    oneLiner: "show the last few lines of a file, where the newest entries in a log usually are.",
    usage: ["tail [options] [file...]"],
    description: [
      "tail prints the end of a file: the last 10 lines, unless you ask for a different number with -n. Logs add new lines at the bottom, so the end is where the latest events are.",
      "-n +5 turns it around: everything from line 5 to the end. With no file name, tail reads text piped in from another command.",
      "On a real computer, tail -f keeps watching a file and prints new lines as they arrive. This practice terminal doesn't have -f, because nothing here writes to logs while you watch.",
    ],
    options: [
      {
        flags: "-n, --lines <n>",
        text: "Show the last n lines. -n 5 and -5 mean the same thing. -n +5 starts at line 5.",
      },
      { flags: "-c, --bytes <n>", text: "Show the last n characters (bytes) instead." },
      { flags: "-q", text: "Don't print file names when showing several files." },
      { flags: "-v", text: "Always print the file name first." },
    ],
    examples: [
      { command: "tail /var/log/auth.log", text: "The 10 most recent sign-in events." },
      { command: "tail -n 3 notes.txt", text: "The last 3 lines of notes.txt." },
    ],
    concept: [
      "When something is happening right now, defenders look at the end of the logs first. The most recent lines show who signed in last, what failed, and what changed.",
      "Checking the newest entries is also how you confirm a fix worked: after changing a setting, the latest log lines should show the problem has stopped.",
    ],
  },

  run(args, state, ctx) {
    return headOrTail(NAME, args, state, ctx);
  },
};
