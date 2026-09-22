import type { Tool } from "../types";
import { copyOrMove } from "./cp";

const NAME = "mv";

export const mv: Tool = {
  name: NAME,
  category: "change",
  help: {
    oneLiner: "move a file or folder somewhere else, or rename it.",
    usage: ["mv [options] source destination", "mv [options] source... folder"],
    description: [
      "mv (move) takes a file or folder and puts it somewhere else. If the last name you give is an existing folder, the file goes inside it. Otherwise the file gets that new name, which is how you rename things on the command line.",
      "Moving keeps the file's owner, permissions and time, because it's the same file in a new place. You need permission to change both folders: the one it leaves and the one it goes to.",
    ],
    options: [
      { flags: "-n, --no-clobber", text: "Never overwrite a file that's already there." },
      { flags: "-v, --verbose", text: "Say each move it makes." },
      { flags: "-f, --force", text: "Overwrite without asking (the default here)." },
    ],
    examples: [
      { command: "mv draft.txt report.txt", text: "Rename draft.txt to report.txt." },
      { command: "mv report.txt reports/", text: "Move report.txt into the reports folder." },
    ],
    concept: [
      "Attackers sometimes hide files by renaming them to look ordinary, or by moving them into busy folders like /tmp. Defenders look for names that don't fit, and for files that changed at odd times.",
      "Renaming a file doesn't change who can read it. A secret moved into a hidden file (a name starting with a dot) is still readable by anyone the permissions allow.",
    ],
  },

  run(args, state, ctx) {
    return copyOrMove(NAME, args, state, ctx);
  },
};
