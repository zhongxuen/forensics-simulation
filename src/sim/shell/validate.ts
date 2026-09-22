/**
 * Shape checks for a ShellCommand read back from JSON (a saved run or a bug report is untrusted
 * input). Everything is checked, with size limits, before the engine sees it.
 */
import type {
  ShellAssignment,
  ShellCommand,
  ShellListItem,
  ShellRedirect,
  ShellSimpleCommand,
  ShellWord,
  ShellWordPart,
} from "./types";

const LIMITS = {
  line: 4096,
  items: 64,
  commands: 32,
  words: 256,
  parts: 256,
  text: 4096,
  redirects: 16,
} as const;

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SPECIAL_VARIABLES = ["?", "$", "0", "#"];
const USER_NAME = /^[a-z_][a-z0-9_-]{0,31}$/;

class ShapeError extends Error {}

type Obj = Record<string, unknown>;

function fail(path: string, expected: string): never {
  throw new ShapeError(`${path}: expected ${expected}`);
}

function obj(value: unknown, path: string): Obj {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "an object");
  return value as Obj;
}

function list<T>(
  value: unknown,
  path: string,
  max: number,
  item: (v: unknown, p: string) => T,
): T[] {
  if (!Array.isArray(value) || value.length > max) fail(path, `a list of at most ${max}`);
  return value.map((entry, i) => item(entry, `${path}[${i}]`));
}

function text(value: unknown, path: string, max: number = LIMITS.text): string {
  if (typeof value !== "string" || value.length > max)
    fail(path, `a string of at most ${max} characters`);
  return value;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "true or false");
  return value;
}

function part(value: unknown, path: string): ShellWordPart {
  const o = obj(value, path);
  if ("tilde" in o) {
    const user = text(o.tilde, `${path}.tilde`, 32);
    if (user !== "" && !USER_NAME.test(user)) fail(`${path}.tilde`, "a user name");
    return { tilde: user };
  }
  if ("variable" in o) {
    const name = text(o.variable, `${path}.variable`, 64);
    if (!NAME.test(name) && !SPECIAL_VARIABLES.includes(name)) fail(`${path}.variable`, "a name");
    return { variable: name, quoted: bool(o.quoted, `${path}.quoted`) };
  }
  return { text: text(o.text, `${path}.text`), quoted: bool(o.quoted, `${path}.quoted`) };
}

const word = (value: unknown, path: string): ShellWord => ({
  parts: list(obj(value, path).parts, `${path}.parts`, LIMITS.parts, part),
});

function assignment(value: unknown, path: string): ShellAssignment {
  const o = obj(value, path);
  const name = text(o.name, `${path}.name`, 64);
  if (!NAME.test(name)) fail(`${path}.name`, "a variable name");
  return { name, value: word(o.value, `${path}.value`) };
}

function redirect(value: unknown, path: string): ShellRedirect {
  const o = obj(value, path);
  if (o.fd !== 0 && o.fd !== 1 && o.fd !== 2) fail(`${path}.fd`, "0, 1 or 2");
  if (o.mode !== "read" && o.mode !== "write" && o.mode !== "append") {
    fail(`${path}.mode`, '"read", "write" or "append"');
  }
  if (o.target === undefined) {
    if (o.fd !== 2) fail(`${path}.target`, "a file (only 2>&1 has none)");
    return { fd: 2, mode: "write" };
  }
  return { fd: o.fd, mode: o.mode, target: word(o.target, `${path}.target`) };
}

function simple(value: unknown, path: string): ShellSimpleCommand {
  const o = obj(value, path);
  return {
    assignments: list(o.assignments, `${path}.assignments`, LIMITS.words, assignment),
    words: list(o.words, `${path}.words`, LIMITS.words, word),
    redirects: list(o.redirects, `${path}.redirects`, LIMITS.redirects, redirect),
  };
}

function item(value: unknown, path: string): ShellListItem {
  const o = obj(value, path);
  if (o.when !== "always" && o.when !== "success" && o.when !== "failure") {
    fail(`${path}.when`, '"always", "success" or "failure"');
  }
  const pipeline = obj(o.pipeline, `${path}.pipeline`);
  const commands = list(pipeline.commands, `${path}.pipeline.commands`, LIMITS.commands, simple);
  if (commands.length === 0) fail(`${path}.pipeline.commands`, "at least one command");
  return { when: o.when, pipeline: { commands } };
}

/** A checked copy of `value`, keeping only known fields, or a readable reason it isn't one. */
export function checkShellCommand(
  value: unknown,
  path = "command",
): { ok: true; command: ShellCommand } | { ok: false; reason: string } {
  try {
    const o = obj(value, path);
    if (o.type !== "shell") fail(`${path}.type`, '"shell"');
    return {
      ok: true,
      command: {
        type: "shell",
        line: text(o.line, `${path}.line`, LIMITS.line),
        list: list(o.list, `${path}.list`, LIMITS.items, item),
      },
    };
  } catch (error) {
    if (error instanceof ShapeError) return { ok: false, reason: error.message };
    throw error;
  }
}
