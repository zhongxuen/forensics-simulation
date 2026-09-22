import { paint, SGR } from "../../core/ansi";
import { stdout } from "../../core/output";
import { sessionFs, sessionHost } from "../../core/session";
import type { OutputLine, SimEvent } from "../../core/types";
import { listDir, readFile, stat } from "../../fs/ops";
import { hasSwitch, optionValue, parseArgs } from "../args";
import type { Tool } from "../types";
import { compilePattern, MAX_PATTERN_LENGTH, type RegexFlavor } from "./regex";
import { fsErrorLine, missingFile, splitLines, STDIN_NAME, usage, type TextInput } from "./shared";

const NAME = "grep";
const MAX_FILES = 500;

export const grep: Tool = {
  name: NAME,
  category: "find",
  help: {
    oneLiner: "find the lines in a file that contain some text.",
    usage: ["grep [options] pattern [file...]", "command | grep [options] pattern"],
    description: [
      "grep reads text line by line and prints only the lines that contain what you're looking for. `grep Failed auth.log` shows every line of auth.log with the word Failed in it. Capital letters count, unless you add -i.",
      "With no file, grep searches text piped in from another command: `cat notes.txt | grep password`. With -r it searches every file in a folder and the folders inside it.",
      "The pattern can be plain text, or a regular expression: a small language for describing text. ^ means the start of a line, $ the end, . any one character, and * any number of the thing before it. Put patterns with spaces or symbols in quotes.",
    ],
    options: [
      { flags: "-i, --ignore-case", text: "Capital letters don't matter." },
      { flags: "-v, --invert-match", text: "Show the lines that don't match instead." },
      { flags: "-n, --line-number", text: "Show each line's number." },
      { flags: "-c, --count", text: "Only count the matching lines." },
      { flags: "-l, --files-with-matches", text: "Only list the files that have a match." },
      {
        flags: "-r, -R, --recursive",
        text: "Search every file in a folder, and in the folders inside it.",
      },
      { flags: "-w, --word-regexp", text: "Match whole words only." },
      { flags: "-x, --line-regexp", text: "Match whole lines only." },
      { flags: "-o, --only-matching", text: "Show only the matching part of each line." },
      {
        flags: "-E, --extended-regexp",
        text: "Extended patterns: +, ?, | and () work without backslashes.",
      },
      {
        flags: "-F, --fixed-strings",
        text: "Treat the pattern as plain text: no special characters.",
      },
      { flags: "-h / -H", text: "Leave out / always show file names in front of matches." },
      {
        flags: "-q, --quiet",
        text: "Print nothing; only the exit status says whether it matched.",
      },
      { flags: "-s, --no-messages", text: "Don't report files that can't be read." },
      {
        flags: "--color[=when]",
        text: "Highlight the matches: auto (on screen only), always, or never.",
      },
    ],
    examples: [
      { command: "grep Failed /var/log/auth.log", text: "Every failed sign-in in the log." },
      {
        command: "grep -i password notes.txt",
        text: "Lines mentioning a password, in any capitals.",
      },
      {
        command: "grep -rn secret ~",
        text: "Search every file in your home folder, with line numbers.",
      },
      { command: "grep -c Failed /var/log/auth.log", text: "Count the failed sign-ins." },
    ],
    concept: [
      "grep is how you find the needle in the haystack. Defenders search logs for failed sign-ins, error codes, or a suspicious address, and a thousand-line log turns into the five lines that matter.",
      "Attackers search too: for words like password or key in files they can read. Running that search on your own systems first, and locking down what it finds, is a real defensive habit.",
    ],
  },

  run(args, state, ctx) {
    let color = ctx.tty;
    const rest: string[] = [];
    for (const arg of args) {
      const match = /^--colou?r(?:=(.*))?$/.exec(arg);
      if (!match) rest.push(arg);
      else color = (match[1] ?? "always") === "always" || ((match[1] ?? "") === "auto" && ctx.tty);
    }
    const parsed = parseArgs(rest, [
      { names: ["-i", "--ignore-case"], key: "ignoreCase" },
      { names: ["-v", "--invert-match"], key: "invert" },
      { names: ["-n", "--line-number"], key: "lineNumber" },
      { names: ["-c", "--count"], key: "count" },
      { names: ["-l", "--files-with-matches"], key: "filesWithMatches" },
      { names: ["-r", "-R", "--recursive"], key: "recursive" },
      { names: ["-w", "--word-regexp"], key: "word" },
      { names: ["-x", "--line-regexp"], key: "line" },
      { names: ["-o", "--only-matching"], key: "onlyMatching" },
      { names: ["-E", "--extended-regexp"], key: "extended" },
      { names: ["-F", "--fixed-strings"], key: "fixed" },
      { names: ["-G", "--basic-regexp"], key: "basic" },
      { names: ["-h", "--no-filename"], key: "noFilename" },
      { names: ["-H", "--with-filename"], key: "withFilename" },
      { names: ["-q", "--quiet", "--silent"], key: "quiet" },
      { names: ["-s", "--no-messages"], key: "noMessages" },
      { names: ["-e", "--regexp"], key: "pattern", takesValue: true },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const on = (key: string) => hasSwitch(parsed.value, key);
    const positionals = [...parsed.value.positionals];
    const pattern = optionValue(parsed.value, "pattern") ?? positionals.shift();
    if (pattern === undefined)
      return usage(NAME, { code: "MISSING_ARGUMENT", argument: "pattern" }, state);
    const flavor: RegexFlavor = on("fixed") ? "fixed" : on("extended") ? "extended" : "basic";
    const patternOptions = {
      flavor,
      ignoreCase: on("ignoreCase"),
      word: on("word"),
      line: on("line"),
    };
    // One copy tests a line; the other (global) finds every match in it, for -o and colour.
    const tester = compilePattern(pattern, patternOptions);
    const finder = compilePattern(pattern, { ...patternOptions, global: true });
    if (!tester || !finder) {
      return usage(
        NAME,
        {
          code: "BAD_ARGUMENT",
          argument: "pattern",
          value: pattern,
          reason: pattern.length > MAX_PATTERN_LENGTH ? "too-long" : "bad-format",
        },
        state,
      );
    }

    // Gather the inputs: files, folders (with -r), or piped-in text.
    const { vfs, ctx: fsCtx } = sessionFs(state, ctx.now);
    const hostId = sessionHost(state).id;
    const inputs: TextInput[] = [];
    const errors: OutputLine[] = [];
    const events: SimEvent[] = [];
    const recursive = on("recursive");
    const addFile = (path: string) => {
      if (inputs.length >= MAX_FILES) return;
      const read = readFile(vfs, fsCtx, path);
      if (!read.ok) {
        errors.push(fsErrorLine(NAME, read.error));
        return;
      }
      inputs.push({ name: path, text: read.value });
      const info = stat(vfs, fsCtx, path);
      if (info.ok) events.push({ type: "file.read", hostId, path: info.value.path });
    };
    const walk = (dir: string, depth: number) => {
      const listing = listDir(vfs, fsCtx, dir);
      if (!listing.ok) {
        errors.push(fsErrorLine(NAME, { ...listing.error, path: dir }));
        return;
      }
      for (const entry of listing.value) {
        const path = `${dir.replace(/\/+$/, "")}/${entry.name}`;
        if (entry.kind === "dir" && depth < 32) walk(path, depth + 1);
        else if (entry.kind === "file") addFile(path);
      }
    };
    const files = positionals.length > 0 ? positionals : recursive ? ["."] : [];
    if (files.length === 0) {
      if (ctx.stdin === undefined) return missingFile(NAME, state);
      inputs.push({ name: STDIN_NAME, text: ctx.stdin });
    }
    for (const name of files) {
      if (name === "-") {
        inputs.push({ name: STDIN_NAME, text: ctx.stdin ?? "" });
        continue;
      }
      const info = stat(vfs, fsCtx, name);
      if (info.ok && info.value.kind === "dir") {
        if (recursive) walk(name, 0);
        else errors.push(fsErrorLine(NAME, { code: "EISDIR", path: name }));
        continue;
      }
      addFile(name);
    }

    const showNames = on("withFilename") || (!on("noFilename") && (inputs.length > 1 || recursive));
    const paintIf = (code: string, text: string) => (color ? paint(code, text) : text);
    const prefix = (name: string, number?: number) =>
      (showNames ? `${paintIf(SGR.fileName, name)}${paintIf(SGR.separator, ":")}` : "") +
      (number !== undefined
        ? `${paintIf(SGR.lineNumber, String(number))}${paintIf(SGR.separator, ":")}`
        : "");

    const output: OutputLine[] = [];
    let anyMatch = false;
    for (const input of inputs) {
      let count = 0;
      splitLines(input.text).forEach((line, index) => {
        if (tester.test(line) === on("invert")) return;
        count++;
        if (on("count") || on("filesWithMatches") || on("quiet")) return;
        const number = on("lineNumber") ? index + 1 : undefined;
        if (on("onlyMatching") && !on("invert")) {
          for (const match of line.matchAll(finder)) {
            if (match[0] !== "") {
              output.push(stdout(`${prefix(input.name, number)}${paintIf(SGR.match, match[0])}`));
            }
          }
          return;
        }
        const shown =
          color && !on("invert")
            ? line.replace(finder, (match) => (match === "" ? match : paint(SGR.match, match)))
            : line;
        output.push(stdout(`${prefix(input.name, number)}${shown}`));
      });
      if (count > 0) anyMatch = true;
      if (on("quiet")) continue;
      if (on("filesWithMatches")) {
        if (count > 0) output.push(stdout(paintIf(SGR.fileName, input.name)));
      } else if (on("count")) {
        output.push(
          stdout(
            `${showNames ? `${paintIf(SGR.fileName, input.name)}${paintIf(SGR.separator, ":")}` : ""}${count}`,
          ),
        );
      }
    }
    const shownErrors = on("noMessages") ? [] : errors;
    const exitCode = errors.length > 0 && !(on("quiet") && anyMatch) ? 2 : anyMatch ? 0 : 1;
    return {
      state,
      output: [...(on("quiet") ? [] : output), ...shownErrors],
      events,
      exitCode,
    };
  },
};
