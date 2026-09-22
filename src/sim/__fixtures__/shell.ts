/**
 * A tiny command-line builder for engine tests. The real parser lives in the terminal feature,
 * which engine code may not import, so tests build ShellCommands with this instead. It splits on
 * spaces only: operators (`|`, `>`, `>>`, `<`, `2>`, `2>>`, `2>&1`, `&&`, `||`, `;`) must stand
 * alone, a word starting with `'` is quoted (no wildcards; `_` stands for a space inside it), and
 * `$NAME` inside a word is a variable. That's enough to exercise the executor.
 */
import { fixedClock } from "../core/clock";
import { step } from "../core/step";
import type { SimResult, SimState } from "../core/types";
import type {
  ShellCommand,
  ShellCondition,
  ShellListItem,
  ShellSimpleCommand,
  ShellWord,
  ShellWordPart,
} from "../shell/types";
import { FIXTURE_NOW } from "./harness";

function word(text: string): ShellWord {
  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) {
    return { parts: [{ text: text.slice(1, -1).replace(/_/g, " "), quoted: true }] };
  }
  const parts: ShellWordPart[] = [];
  let rest = text;
  if (rest === "~" || rest.startsWith("~/")) {
    parts.push({ tilde: "" });
    rest = rest.slice(1);
  }
  for (const piece of rest.split(/(\$[A-Za-z_?][A-Za-z0-9_]*)/)) {
    if (piece === "") continue;
    if (piece.startsWith("$")) parts.push({ variable: piece.slice(1), quoted: false });
    else parts.push({ text: piece, quoted: false });
  }
  return { parts };
}

const REDIRECTS: Record<string, { fd: 0 | 1 | 2; mode: "read" | "write" | "append" }> = {
  "<": { fd: 0, mode: "read" },
  ">": { fd: 1, mode: "write" },
  ">>": { fd: 1, mode: "append" },
  "2>": { fd: 2, mode: "write" },
  "2>>": { fd: 2, mode: "append" },
};

/** Builds a ShellCommand from a line like "cat notes.txt | grep day > out.txt && wc -l out.txt". */
export function sh(line: string): ShellCommand {
  const tokens = line.split(/\s+/).filter(Boolean);
  const list: ShellListItem[] = [];
  let when: ShellCondition = "always";
  let commands: ShellSimpleCommand[] = [];
  let current: {
    assignments: ShellSimpleCommand["assignments"][number][];
    words: ShellWord[];
    redirects: ShellSimpleCommand["redirects"][number][];
  } = {
    assignments: [],
    words: [],
    redirects: [],
  };
  const endCommand = () => {
    commands.push(current);
    current = { assignments: [], words: [], redirects: [] };
  };
  const endPipeline = (next: ShellCondition) => {
    endCommand();
    list.push({ when, pipeline: { commands } });
    commands = [];
    when = next;
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] as string;
    if (token === "|") endCommand();
    else if (token === "&&") endPipeline("success");
    else if (token === "||") endPipeline("failure");
    else if (token === ";") endPipeline("always");
    else if (token === "2>&1") current.redirects.push({ fd: 2, mode: "write" });
    else if (Object.hasOwn(REDIRECTS, token)) {
      const target = tokens[++i];
      if (target === undefined) throw new Error(`sh(): ${token} needs a file`);
      current.redirects.push({
        ...(REDIRECTS[token] as (typeof REDIRECTS)[string]),
        target: word(target),
      });
    } else if (current.words.length === 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
      const [name, ...value] = token.split("=");
      current.assignments.push({ name: name as string, value: word(value.join("=")) });
    } else current.words.push(word(token));
  }
  if (current.words.length > 0 || current.assignments.length > 0 || current.redirects.length > 0) {
    endPipeline("always");
  }
  return { type: "shell", line, list };
}

/** Runs one command line against `state`, at the fixture's fixed time. */
export const shell = (state: SimState, line: string): SimResult =>
  step(state, sh(line), fixedClock(FIXTURE_NOW));

/** Runs several lines in order, returning each result. */
export function shellSession(state: SimState, ...lines: string[]): SimResult[] {
  const results: SimResult[] = [];
  let current = state;
  for (const line of lines) {
    const result = shell(current, line);
    results.push(result);
    current = result.state;
  }
  return results;
}

/** What reached the screen, with colour codes left in. */
export const screen = (result: SimResult): string =>
  result.output.map((line) => line.text).join("\n");
