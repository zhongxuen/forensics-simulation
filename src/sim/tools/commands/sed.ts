import { errorLineText, stdout } from "../../core/output";
import { fileChanged, sessionFs, withSessionFs } from "../../core/session";
import type { OutputLine, SimEvent, SimResult, SimState } from "../../core/types";
import { readFile, realpath, writeFile } from "../../fs/ops";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { compilePattern, type RegexFlavor } from "./regex";
import { fsErrorLine, joinLines, missingFile, readInputs, splitLines, usage } from "./shared";

const NAME = "sed";

/** One `s/pattern/replacement/flags` command. */
interface Substitution {
  readonly regex: RegExp;
  readonly replacement: string;
  readonly global: boolean;
  /** Replace only the nth match (s/a/b/2). */
  readonly nth: number;
  readonly print: boolean;
}

/** Reads a script of one or more `s` commands, separated by `;` or new lines. */
function parseScript(
  script: string,
  flavor: RegexFlavor,
): { ok: true; commands: Substitution[] } | { ok: false; message: string } {
  const commands: Substitution[] = [];
  let i = 0;
  const problem = (text: string) => ({ ok: false as const, message: `char ${i + 1}: ${text}` });
  while (i < script.length) {
    while (i < script.length && /[\s;]/.test(script[i] as string)) i++;
    if (i >= script.length) break;
    if (script[i] !== "s") return problem(`unknown command: \`${script[i]}'`);
    const delimiter = script[i + 1];
    if (delimiter === undefined || delimiter === "\\" || delimiter === "\n") {
      return problem("unterminated `s' command");
    }
    i += 2;
    const readPart = (): string | undefined => {
      let part = "";
      while (i < script.length) {
        const char = script[i] as string;
        if (char === "\\" && script[i + 1] === delimiter) {
          part += delimiter;
          i += 2;
          continue;
        }
        if (char === "\\" && i + 1 < script.length) {
          part += char + (script[i + 1] as string);
          i += 2;
          continue;
        }
        if (char === delimiter) {
          i++;
          return part;
        }
        part += char;
        i++;
      }
      return undefined;
    };
    const pattern = readPart();
    const replacement = pattern === undefined ? undefined : readPart();
    if (pattern === undefined || replacement === undefined)
      return problem("unterminated `s' command");
    let flags = "";
    while (i < script.length && !/[\s;]/.test(script[i] as string)) flags += script[i++];
    const flagMatch = /^([gpiI]|\d+)*$/.test(flags);
    if (!flagMatch) return problem(`unknown option to \`s'`);
    const regex = compilePattern(pattern, {
      flavor,
      ignoreCase: /[iI]/.test(flags),
      global: true,
    });
    if (!regex) return problem("the pattern can't be read");
    commands.push({
      regex,
      replacement,
      global: flags.includes("g"),
      nth: Number(/\d+/.exec(flags)?.[0] ?? "1") || 1,
      print: flags.includes("p"),
    });
  }
  if (commands.length === 0)
    return { ok: false, message: "char 0: no previous regular expression" };
  return { ok: true, commands };
}

/** Fills in a replacement: & is the whole match, \1 to \9 the groups, \n a new line. */
function expandReplacement(
  replacement: string,
  match: string,
  groups: readonly (string | undefined)[],
): string {
  let out = "";
  for (let i = 0; i < replacement.length; i++) {
    const char = replacement[i] as string;
    if (char === "&") {
      out += match;
    } else if (char === "\\" && i + 1 < replacement.length) {
      const next = replacement[++i] as string;
      if (/[1-9]/.test(next)) out += groups[Number(next) - 1] ?? "";
      else if (next === "n") out += "\n";
      else if (next === "t") out += "\t";
      else out += next;
    } else {
      out += char;
    }
  }
  return out;
}

/** Applies the commands to one line. Returns the new line and whether any substitution happened. */
function apply(line: string, commands: readonly Substitution[]): { line: string; print: boolean } {
  let current = line;
  let print = false;
  for (const command of commands) {
    let seen = 0;
    let changed = false;
    command.regex.lastIndex = 0;
    current = current.replace(command.regex, (match: string, ...rest: unknown[]) => {
      seen++;
      const wanted = command.global ? seen >= command.nth : seen === command.nth;
      if (!wanted) return match;
      changed = true;
      const groups = rest
        .slice(0, -2)
        .map((group) => (typeof group === "string" ? group : undefined));
      return expandReplacement(command.replacement, match, groups);
    });
    if (changed && command.print) print = true;
  }
  return { line: current, print };
}

export const sed: Tool = {
  name: NAME,
  category: "text",
  help: {
    oneLiner: "find and replace text in a file or in piped text, with s/old/new/.",
    usage: ["sed 's/old/new/' [file...]", "sed -i 's/old/new/g' file..."],
    description: [
      'sed (stream editor) changes text as it flows past. This practice version does one job: substitution. `sed \'s/cat/dog/\' pets.txt` prints pets.txt with the first "cat" on each line replaced by "dog". Add g at the end (s/cat/dog/g) to replace every one, not only the first.',
      "sed prints the changed text and leaves the file alone, unless you add -i (in place), which saves the changes back into the file. You need permission to change the file for that.",
      "The old text is a pattern, like grep's: . means any character, so write \\. for a real dot. Put the whole s/old/new/ in single quotes so the terminal passes it to sed untouched.",
    ],
    options: [
      { flags: "-i, --in-place", text: "Save the changes into the file instead of printing them." },
      { flags: "-n, --quiet", text: "Only print lines a /p command marks." },
      { flags: "-e, --expression <s>", text: "Add a command. Use it more than once for several." },
      { flags: "-E, -r", text: "Extended patterns: +, ?, | and () work without backslashes." },
    ],
    examples: [
      {
        command: "sed 's/colour/color/g' notes.txt",
        text: "Show notes.txt with every colour changed to color.",
      },
      {
        command: "sed -i 's/password=.*/password=REMOVED/' app.conf",
        text: "Blank out a password written in a settings file, and save it.",
      },
      {
        command: "echo hello world | sed 's/world/there/'",
        text: "Change piped text: prints hello there.",
      },
    ],
    concept: [
      "Defenders use sed to fix settings files quickly and the same way every time, like switching off a risky option on many computers at once.",
      "Before a report or a log is shared, sensitive details like passwords or personal information are removed or replaced. That's called redaction, and a sed substitution is one way to do it.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-i", "--in-place"], key: "inPlace" },
      { names: ["-n", "--quiet", "--silent"], key: "quiet" },
      { names: ["-e", "--expression"], key: "expression", takesValue: true },
      { names: ["-E", "-r", "--regexp-extended"], key: "extended" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    // -e may appear more than once; parseArgs keeps the last, so collect them here.
    const expressions: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if ((args[i] === "-e" || args[i] === "--expression") && args[i + 1] !== undefined) {
        expressions.push(args[i + 1] as string);
        i++;
      } else if (args[i]?.startsWith("--expression=")) {
        expressions.push((args[i] as string).slice("--expression=".length));
      }
    }
    const positionals = [...parsed.value.positionals];
    if (expressions.length === 0) {
      const script = positionals.shift();
      if (script === undefined)
        return usage(NAME, { code: "MISSING_ARGUMENT", argument: "script" }, state);
      expressions.push(script);
    }
    const flavor: RegexFlavor = hasSwitch(parsed.value, "extended") ? "extended" : "basic";
    const commands: Substitution[] = [];
    for (const [index, expression] of expressions.entries()) {
      const script = parseScript(expression, flavor);
      if (!script.ok) {
        return {
          state,
          output: [
            errorLineText(`sed: -e expression #${index + 1}, ${script.message}`, {
              code: "BAD_ARGUMENT",
              argument: "expression",
              value: expression,
              reason: "bad-format",
            }),
          ],
          events: [],
          exitCode: 1,
        };
      }
      commands.push(...script.commands);
    }

    const quiet = hasSwitch(parsed.value, "quiet");
    const transform = (text: string): string[] =>
      splitLines(text).flatMap((line) => {
        const result = apply(line, commands);
        const shown = quiet ? [] : [result.line];
        return result.print ? [...shown, result.line] : shown;
      });

    if (hasSwitch(parsed.value, "inPlace")) return inPlace(positionals, transform, state, ctx.now);

    const read = readInputs(NAME, positionals, state, ctx);
    if (!read) return missingFile(NAME, state);
    const output: OutputLine[] = [];
    for (const item of read.items) {
      if ("error" in item) output.push(item.error);
      else output.push(...transform(item.text).map(stdout));
    }
    return { state, output, events: read.events, exitCode: read.errors.length > 0 ? 2 : 0 };
  },
};

/** sed -i: each file is read, changed, and written back, if the permissions allow both. */
function inPlace(
  files: readonly string[],
  transform: (text: string) => string[],
  state: SimState,
  now: number,
): SimResult {
  if (files.length === 0) {
    return usage(
      NAME,
      { code: "MISSING_ARGUMENT", argument: "input files (-i needs a file name)" },
      state,
    );
  }
  let next = state;
  const output: OutputLine[] = [];
  const events: SimEvent[] = [];
  for (const file of files) {
    const { vfs, ctx } = sessionFs(next, now);
    const read = readFile(vfs, ctx, file);
    if (!read.ok) {
      output.push(fsErrorLine(NAME, read.error, "can't read"));
      continue;
    }
    const changed = joinLines(transform(read.value));
    if (changed === read.value) continue;
    const written = writeFile(vfs, ctx, file, changed);
    if (!written.ok) {
      output.push(fsErrorLine(NAME, written.error, "couldn't edit"));
      continue;
    }
    next = withSessionFs(next, written.value);
    const path = realpath(written.value, ctx, file);
    if (path.ok) events.push(fileChanged(next, path.value, "modified"));
  }
  return { state: next, output, events, exitCode: output.length > 0 ? 4 : 0 };
}
