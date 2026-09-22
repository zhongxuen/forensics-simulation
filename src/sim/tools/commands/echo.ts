import { stdout, success } from "../../core/output";
import type { Tool } from "../types";

const NAME = "echo";

/** Backslash codes for `echo -e`: \n new line, \t tab, \\ a backslash. */
const unescape = (text: string): string =>
  text.replace(/\\(.)/g, (whole, char: string) =>
    char === "n" ? "\n" : char === "t" ? "\t" : char === "\\" ? "\\" : whole,
  );

export const echo: Tool = {
  name: NAME,
  category: "text",
  help: {
    oneLiner: "print back whatever you type after it.",
    usage: ["echo [options] [text...]"],
    description: [
      "echo prints its words, separated by spaces. On its own that sounds pointless, but it's how you see what a variable holds (`echo $HOME`), and how you put text into a file: `echo hello > greeting.txt` writes hello into greeting.txt.",
      "The > sends what a command prints into a file instead of the screen, replacing what was there. >> adds to the end of the file instead.",
    ],
    options: [
      { flags: "-n", text: "Don't end with a new line." },
      { flags: "-e", text: "Understand backslash codes: \\n for a new line, \\t for a tab." },
      { flags: "-E", text: "Print backslashes as they are (the default)." },
    ],
    examples: [
      { command: "echo hello", text: "Prints hello." },
      { command: "echo $USER", text: "Prints the value of the USER variable: your account name." },
      { command: "echo 'first note' >> notes.txt", text: "Add a line to the end of notes.txt." },
    ],
    concept: [
      "Echo is how scripts talk and how quick notes get written, and it's also a way to check what the shell will do before it does it: `echo rm *` shows exactly which files a wildcard would hit, without deleting anything.",
      "Writing into a file with > replaces everything in it. Checking with ls and cat before overwriting is the habit that saves you from losing work.",
    ],
  },

  run(args, state) {
    // echo takes only leading -n/-e/-E options; any other word starting with a dash is text.
    let newline = true;
    let escapes = false;
    let i = 0;
    for (; i < args.length; i++) {
      const arg = args[i] as string;
      if (!/^-[neE]+$/.test(arg)) break;
      for (const flag of arg.slice(1)) {
        if (flag === "n") newline = false;
        else if (flag === "e") escapes = true;
        else escapes = false;
      }
    }
    const text = args.slice(i).join(" ");
    const shown = escapes ? unescape(text) : text;
    const lines = shown.split("\n");
    if (!newline && lines[lines.length - 1] === "") lines.pop();
    return success(state, lines.map(stdout));
  },
};
