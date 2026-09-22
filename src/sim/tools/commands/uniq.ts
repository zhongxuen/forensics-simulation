import { stdout } from "../../core/output";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { extraArgument, missingFile, readInputs, splitLines, usage } from "./shared";

const NAME = "uniq";

export const uniq: Tool = {
  name: NAME,
  category: "text",
  help: {
    oneLiner: "squash repeated lines into one, and count them with -c.",
    usage: ["uniq [options] [file]", "command | uniq [options]"],
    description: [
      "uniq removes a line when it's the same as the line right before it. Repeats that aren't next to each other stay, so it's almost always used after sort, which puts identical lines together.",
      "-c puts a count in front of each line: how many times it appeared in a row. That turns a long list into a tally.",
    ],
    options: [
      { flags: "-c, --count", text: "Show how many times each line appeared." },
      { flags: "-d, --repeated", text: "Only show lines that appear more than once." },
      { flags: "-u, --unique", text: "Only show lines that appear once." },
      { flags: "-i, --ignore-case", text: "Capital letters don't matter." },
    ],
    examples: [
      { command: "sort names.txt | uniq", text: "Each name once." },
      {
        command: "sort addresses.txt | uniq -c | sort -rn",
        text: "Addresses by how often they appear, most first.",
      },
    ],
    concept: [
      "Counting repeats is one of the quickest ways to find what's unusual. In a sign-in log, one address appearing 400 times, when the rest appear once or twice, is the address to look into.",
      'The pattern sort | uniq -c | sort -rn is a classic analyst\'s move: it answers "what happens most?" in a single line.',
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-c", "--count"], key: "count" },
      { names: ["-d", "--repeated"], key: "repeated" },
      { names: ["-u", "--unique"], key: "unique" },
      { names: ["-i", "--ignore-case"], key: "ignoreCase" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const [file, extra] = parsed.value.positionals;
    // A second name would be where to write the result; this terminal uses > for that.
    if (extra !== undefined) return extraArgument(NAME, extra, state);
    const read = readInputs(NAME, file === undefined ? [] : [file], state, ctx);
    if (!read) return missingFile(NAME, state);
    const same = (a: string, b: string) =>
      hasSwitch(parsed.value, "ignoreCase") ? a.toLowerCase() === b.toLowerCase() : a === b;
    const groups: { line: string; count: number }[] = [];
    for (const line of read.inputs.flatMap((input) => splitLines(input.text))) {
      const last = groups[groups.length - 1];
      if (last && same(last.line, line)) last.count++;
      else groups.push({ line, count: 1 });
    }
    const kept = groups.filter(
      ({ count }) =>
        (!hasSwitch(parsed.value, "repeated") || count > 1) &&
        (!hasSwitch(parsed.value, "unique") || count === 1),
    );
    const lines = kept.map(({ line, count }) =>
      hasSwitch(parsed.value, "count") ? `${String(count).padStart(7)} ${line}` : line,
    );
    return {
      state,
      output: [...read.errors, ...lines.map(stdout)],
      events: read.events,
      exitCode: read.errors.length > 0 ? 1 : 0,
    };
  },
};
