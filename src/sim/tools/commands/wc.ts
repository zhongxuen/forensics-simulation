import { stdout } from "../../core/output";
import type { OutputLine } from "../../core/types";
import { byteLength } from "../../fs/tree";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { missingFile, readInputs, STDIN_NAME, usage } from "./shared";

const NAME = "wc";

interface Counts {
  lines: number;
  words: number;
  bytes: number;
  chars: number;
}

const count = (text: string): Counts => ({
  lines: (text.match(/\n/g) ?? []).length,
  words: text.split(/\s+/).filter(Boolean).length,
  bytes: byteLength(text),
  chars: [...text].length,
});

export const wc: Tool = {
  name: NAME,
  category: "text",
  help: {
    oneLiner: "count the lines, words and characters in a file.",
    usage: ["wc [options] [file...]", "command | wc [options]"],
    description: [
      "wc (word count) prints three numbers for each file: how many lines, how many words, and how many bytes (roughly, characters). Add -l to count only lines, which is what it's used for most.",
      "It's at its best at the end of a pipeline: `grep Failed auth.log | wc -l` counts how many lines grep found. The | (pipe) sends one command's output into the next command.",
    ],
    options: [
      { flags: "-l, --lines", text: "Count lines." },
      { flags: "-w, --words", text: "Count words." },
      { flags: "-c, --bytes", text: "Count bytes." },
      { flags: "-m, --chars", text: "Count characters." },
    ],
    examples: [
      { command: "wc notes.txt", text: "Lines, words and bytes in notes.txt." },
      { command: "wc -l /etc/passwd", text: "How many accounts this computer has, one per line." },
    ],
    concept: [
      'Numbers turn a hunch into a finding. "Lots of failed sign-ins" becomes "340 failed sign-ins in ten minutes", which is something a team can act on and a report can state.',
      "A sudden change in a count is a clue too: a log that's much shorter than yesterday's may have had lines deleted.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-l", "--lines"], key: "lines" },
      { names: ["-w", "--words"], key: "words" },
      { names: ["-c", "--bytes"], key: "bytes" },
      { names: ["-m", "--chars"], key: "chars" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const read = readInputs(NAME, parsed.value.positionals, state, ctx);
    if (!read) return missingFile(NAME, state);
    const picked = (["lines", "words", "chars", "bytes"] as const).filter((key) =>
      hasSwitch(parsed.value, key),
    );
    const fields: readonly (keyof Counts)[] =
      picked.length > 0 ? picked : ["lines", "words", "bytes"];

    const rows: { counts: Counts; name: string }[] = read.inputs.map((input) => ({
      counts: count(input.text),
      name: input.name === STDIN_NAME ? "" : input.name,
    }));
    if (rows.length > 1) {
      const total: Counts = { lines: 0, words: 0, bytes: 0, chars: 0 };
      for (const { counts } of rows) {
        for (const key of Object.keys(total) as (keyof Counts)[]) total[key] += counts[key];
      }
      rows.push({ counts: total, name: "total" });
    }
    // Like GNU wc: numbers are as wide as the biggest one, or 7 wide when reading piped text.
    const onlyPiped = read.inputs.every((input) => input.name === STDIN_NAME);
    const widest = Math.max(
      1,
      ...rows.flatMap(({ counts }) => fields.map((f) => String(counts[f]).length)),
    );
    const width =
      onlyPiped && fields.length > 1 ? 7 : fields.length === 1 && rows.length === 1 ? 0 : widest;
    const output: OutputLine[] = [];
    for (const item of read.items) if ("error" in item) output.push(item.error);
    for (const { counts, name } of rows) {
      const numbers = fields.map((f) => String(counts[f]).padStart(width)).join(" ");
      output.push(stdout(name ? `${numbers} ${name}` : numbers));
    }
    return { state, output, events: read.events, exitCode: read.errors.length > 0 ? 1 : 0 };
  },
};
