import { stdout } from "../../core/output";
import { optionValue, parseArgs } from "../args";
import type { Tool } from "../types";
import { missingFile, readInputs, splitLines, usage } from "./shared";

const NAME = "cut";

/** "1,3" or "2-4" or "3-" or "-2", as a test for 1-based positions. */
function parseList(text: string): ((position: number) => boolean) | undefined {
  const ranges: [number, number][] = [];
  for (const part of text.split(",")) {
    const match = /^(\d*)(-?)(\d*)$/.exec(part);
    if (!match || part === "" || part === "-") return undefined;
    const [, from, dash, to] = match;
    const lo = from === "" ? 1 : Number(from);
    const hi = dash === "" ? lo : to === "" ? Number.POSITIVE_INFINITY : Number(to);
    if (lo < 1 || hi < lo) return undefined;
    ranges.push([lo, hi]);
  }
  return (position) => ranges.some(([lo, hi]) => position >= lo && position <= hi);
}

export const cut: Tool = {
  name: NAME,
  category: "text",
  help: {
    oneLiner: "keep only some columns of each line, like one column of a spreadsheet.",
    usage: ["cut -d <separator> -f <columns> [file...]", "cut -c <positions> [file...]"],
    description: [
      "Many files are laid out in columns with a separator between them. In /etc/passwd, colons (:) separate the columns: name, password placeholder, user number, group number, full name, home folder, and shell.",
      "cut -d : -f 1 keeps only the first column of each line (-d says what the separator is, -f which columns). -f 1,6 keeps columns 1 and 6, and -f 3- keeps column 3 onwards. -c keeps characters at certain positions instead.",
    ],
    options: [
      { flags: "-d, --delimiter <c>", text: "The character between columns. Tab, unless you say." },
      { flags: "-f, --fields <list>", text: "Which columns to keep: 1, 1,3, 2-4 or 3-." },
      { flags: "-c, --characters <list>", text: "Which character positions to keep." },
    ],
    examples: [
      { command: "cut -d : -f 1 /etc/passwd", text: "The name of every account on this computer." },
      { command: "cut -d : -f 1,7 /etc/passwd", text: "Each account and the shell it uses." },
      {
        command: "cut -c 1-10 /var/log/auth.log",
        text: "The first ten characters of each line: the dates.",
      },
    ],
    concept: [
      "Logs and system files are data. Pulling out one column (every address, every user name) turns them into lists you can sort, count and compare.",
      "Checking /etc/passwd for accounts that shouldn't exist, or that have a login shell when they shouldn't, is a real part of reviewing a computer's security.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-d", "--delimiter"], key: "delimiter", takesValue: true },
      { names: ["-f", "--fields"], key: "fields", takesValue: true },
      { names: ["-c", "--characters", "-b", "--bytes"], key: "chars", takesValue: true },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const fieldsText = optionValue(parsed.value, "fields");
    const charsText = optionValue(parsed.value, "chars");
    if ((fieldsText === undefined) === (charsText === undefined)) {
      return usage(NAME, { code: "MISSING_ARGUMENT", argument: "-f or -c (pick one)" }, state);
    }
    const listText = (fieldsText ?? charsText) as string;
    const keep = parseList(listText);
    if (!keep) {
      return usage(
        NAME,
        { code: "BAD_ARGUMENT", argument: "list", value: listText, reason: "bad-format" },
        state,
      );
    }
    const delimiter = optionValue(parsed.value, "delimiter") ?? "\t";
    if (delimiter.length !== 1) {
      return usage(
        NAME,
        { code: "BAD_ARGUMENT", argument: "delimiter", value: delimiter, reason: "bad-format" },
        state,
      );
    }
    const read = readInputs(NAME, parsed.value.positionals, state, ctx);
    if (!read) return missingFile(NAME, state);
    const lines = read.inputs.flatMap((input) => splitLines(input.text));
    const result = lines.map((line) => {
      if (charsText !== undefined) {
        return [...line].filter((_, i) => keep(i + 1)).join("");
      }
      // A line without the separator is printed whole, like GNU cut.
      if (!line.includes(delimiter)) return line;
      return line
        .split(delimiter)
        .filter((_, i) => keep(i + 1))
        .join(delimiter);
    });
    return {
      state,
      output: [...read.errors, ...result.map(stdout)],
      events: read.events,
      exitCode: read.errors.length > 0 ? 1 : 0,
    };
  },
};
