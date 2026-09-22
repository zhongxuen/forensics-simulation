import { stdout } from "../../core/output";
import { hasSwitch, optionValue, parseArgs } from "../args";
import type { Tool } from "../types";
import { missingFile, readInputs, splitLines, usage, wholeNumber } from "./shared";

const NAME = "sort";

/** The leading number in a line, for -n: "  42 apples" sorts as 42. Lines without one count as 0. */
const leadingNumber = (text: string): number => {
  const match = /^\s*(-?\d+(?:\.\d+)?)/.exec(text);
  return match ? Number(match[1]) : 0;
};

export const sort: Tool = {
  name: NAME,
  category: "text",
  help: {
    oneLiner: "put lines in order: alphabetical, or by number with -n.",
    usage: ["sort [options] [file...]", "command | sort [options]"],
    description: [
      "sort reads lines and prints them in order. By default that's alphabetical. -n sorts by the number at the start of each line, so 9 comes before 10, and -r reverses the order.",
      "To sort by a column instead of the whole line, use -k: -k 2 sorts by the second word. -t says what separates the columns, like -t : for the colon-separated lines in /etc/passwd.",
    ],
    options: [
      { flags: "-n, --numeric-sort", text: "Sort by number, not alphabetically." },
      { flags: "-r, --reverse", text: "Biggest or last first." },
      { flags: "-u, --unique", text: "Show each line only once." },
      { flags: "-f, --ignore-case", text: "Capital letters don't matter." },
      { flags: "-k, --key <n>", text: "Sort by column n instead of the whole line." },
      {
        flags: "-t, --field-separator <c>",
        text: "What separates columns (spaces, unless you say).",
      },
    ],
    examples: [
      { command: "sort names.txt", text: "The lines of names.txt in alphabetical order." },
      { command: "sort -t : -k 3 -n /etc/passwd", text: "Accounts in order of their user number." },
      {
        command: "grep Failed auth.log | sort | uniq -c",
        text: "Group matching lines, ready to count.",
      },
    ],
    concept: [
      "Sorting makes patterns jump out. Sort a list of sign-in addresses and repeats end up next to each other, ready for uniq -c to count them: the address with hundreds of failed sign-ins stands out at once.",
      "Analysts chain small commands like this (grep, then sort, then uniq, then sort again) to answer questions about huge logs in seconds.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-n", "--numeric-sort"], key: "numeric" },
      { names: ["-r", "--reverse"], key: "reverse" },
      { names: ["-u", "--unique"], key: "unique" },
      { names: ["-f", "--ignore-case"], key: "ignoreCase" },
      { names: ["-k", "--key"], key: "key", takesValue: true },
      { names: ["-t", "--field-separator"], key: "separator", takesValue: true },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const keyText = optionValue(parsed.value, "key");
    const key = keyText === undefined ? undefined : wholeNumber(keyText.split(/[.,]/)[0], 1000);
    if (keyText !== undefined && (key === undefined || key === 0)) {
      return usage(
        NAME,
        { code: "BAD_ARGUMENT", argument: "key", value: keyText, reason: "bad-format" },
        state,
      );
    }
    const separator = optionValue(parsed.value, "separator");
    if (separator !== undefined && separator.length !== 1) {
      return usage(
        NAME,
        {
          code: "BAD_ARGUMENT",
          argument: "field separator",
          value: separator,
          reason: "bad-format",
        },
        state,
      );
    }
    const read = readInputs(NAME, parsed.value.positionals, state, ctx);
    if (!read) return missingFile(NAME, state);

    const sortKey = (line: string): string => {
      if (key === undefined) return line;
      const fields = separator === undefined ? line.trim().split(/\s+/) : line.split(separator);
      return fields.slice(key - 1).join(separator ?? " ");
    };
    const fold = (text: string) =>
      hasSwitch(parsed.value, "ignoreCase") ? text.toLowerCase() : text;
    const numeric = hasSwitch(parsed.value, "numeric");
    const lines = read.inputs.flatMap((input) => splitLines(input.text));
    const sorted = [...lines].sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      if (numeric) {
        const diff = leadingNumber(ka) - leadingNumber(kb);
        if (diff !== 0) return diff;
      } else {
        // Dictionary-like and deterministic: letters compare without case first (like sort in a
        // normal locale), then exactly, so the same input always sorts the same way anywhere.
        const fa = fold(ka).toLowerCase();
        const fb = fold(kb).toLowerCase();
        if (fa !== fb) return fa < fb ? -1 : 1;
      }
      return a < b ? -1 : a > b ? 1 : 0;
    });
    if (hasSwitch(parsed.value, "reverse")) sorted.reverse();
    const result = hasSwitch(parsed.value, "unique")
      ? sorted.filter(
          (line, i) => i === 0 || fold(sortKey(line)) !== fold(sortKey(sorted[i - 1] ?? "")),
        )
      : sorted;
    return {
      state,
      output: [...read.errors, ...result.map(stdout)],
      events: read.events,
      exitCode: read.errors.length > 0 ? 2 : 0,
    };
  },
};
