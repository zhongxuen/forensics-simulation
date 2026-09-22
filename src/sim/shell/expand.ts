/**
 * Word expansion, the part of a shell that turns what was typed into a command's arguments:
 *
 * - variables: `$HOME`, `${USER}`, `$?` (the last exit status on this line)
 * - `~` and `~name`: a home folder
 * - wildcards (globs): unquoted `*`, `?` and `[abc]` match file names, as the session's user sees
 *   them. A pattern that matches nothing is left as typed, like bash does.
 *
 * Simplifications, on purpose: a variable's value is never split into several words or treated as
 * a pattern (as if it were always quoted), and there's no command substitution. Everything reads
 * state; nothing here changes it.
 */
import { listDir, stat } from "../fs/ops";
import { isAbsolute } from "../fs/path";
import { sessionFs, sessionMachine } from "../core/session";
import type { SimState } from "../core/types";
import type { ShellWord } from "./types";

/** The shell's own process id, as `$$` reports it. Fixed, so runs stay deterministic. */
const SHELL_PID = "4127";

export interface ExpandContext {
  readonly state: SimState;
  /** The exit status of the last pipeline on this line, for `$?`. */
  readonly lastExit: number;
  readonly now: number;
}

/** A word's text, with which characters are live wildcards (unquoted `*`, `?`, `[`). */
interface Pattern {
  readonly text: string;
  readonly live: readonly boolean[];
}

/** One word to one string: no wildcards. For variable assignments. */
export function expandToString(word: ShellWord, ctx: ExpandContext): string {
  return build(word, ctx).text;
}

/** One word to its arguments: usually one, several when a wildcard matches several files. */
export function expandWord(word: ShellWord, ctx: ExpandContext): string[] {
  const pattern = build(word, ctx);
  if (!pattern.live.some(Boolean)) return [pattern.text];
  const matches = glob(pattern, ctx);
  return matches.length > 0 ? matches : [pattern.text];
}

function build(word: ShellWord, ctx: ExpandContext): Pattern {
  let text = "";
  const live: boolean[] = [];
  const add = (value: string, wild: boolean) => {
    for (const char of value) {
      text += char;
      live.push(wild && (char === "*" || char === "?" || char === "["));
    }
  };
  for (const part of word.parts) {
    if ("tilde" in part) add(homeOf(part.tilde, ctx.state), false);
    else if ("variable" in part) add(variable(part.variable, ctx), false);
    else add(part.text, !part.quoted);
  }
  return { text, live };
}

function variable(name: string, ctx: ExpandContext): string {
  const { env, cwd } = ctx.state.session;
  switch (name) {
    case "?":
      return String(ctx.lastExit);
    case "$":
      return SHELL_PID;
    case "0":
      return "bash";
    case "#":
      return "0";
    case "PWD":
      return cwd;
    default:
      return Object.hasOwn(env, name) ? (env[name] as string) : "";
  }
}

/** `~` is $HOME; `~name` is that user's home folder, or stays as typed if there's no such user. */
function homeOf(user: string, state: SimState): string {
  if (user === "") {
    const { env } = state.session;
    return Object.hasOwn(env, "HOME") ? (env.HOME as string) : "/";
  }
  const { accounts } = sessionMachine(state);
  return Object.hasOwn(accounts.users, user) ? (accounts.users[user]?.home ?? "/") : `~${user}`;
}

// ---------------------------------------------------------------------------------------------
// Wildcards
// ---------------------------------------------------------------------------------------------

/** Splits a pattern into its path segments, keeping which characters are live. */
function segments(pattern: Pattern): Pattern[] {
  const result: Pattern[] = [];
  let text = "";
  let live: boolean[] = [];
  [...pattern.text].forEach((char, i) => {
    if (char === "/") {
      if (text !== "") result.push({ text, live });
      text = "";
      live = [];
      return;
    }
    text += char;
    live.push(pattern.live[i] ?? false);
  });
  if (text !== "") result.push({ text, live });
  return result;
}

/** A segment with live wildcards, as a regular expression over one file name. */
function segmentMatcher(segment: Pattern): RegExp {
  const chars = [...segment.text];
  let source = "";
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i] as string;
    if (!segment.live[i]) {
      source += escapeRegex(char);
    } else if (char === "*") {
      source += ".*";
    } else if (char === "?") {
      source += ".";
    } else {
      // A bracket expression: [abc], [a-z], [!abc]. Without a closing ], it's a literal "[".
      let j = i + 1;
      let negate = false;
      if (chars[j] === "!" || chars[j] === "^") {
        negate = true;
        j++;
      }
      const start = j;
      if (chars[j] === "]") j++;
      while (j < chars.length && chars[j] !== "]") j++;
      if (j >= chars.length) {
        source += "\\[";
        continue;
      }
      const body = chars
        .slice(start, j)
        .map((c) => (c === "\\" || c === "]" || c === "[" || c === "^" ? `\\${c}` : c))
        .join("");
      source += `[${negate ? "^" : ""}${body}]`;
      i = j;
    }
  }
  return new RegExp(`^${source}$`, "s");
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function join(prefix: string, name: string): string {
  if (prefix === "") return name;
  return prefix.endsWith("/") ? `${prefix}${name}` : `${prefix}/${name}`;
}

/** File names matching the pattern, sorted, as the session's user can see them. */
function glob(pattern: Pattern, ctx: ExpandContext): string[] {
  const { vfs, ctx: fsCtx } = sessionFs(ctx.state, ctx.now);
  const wantsDir = pattern.text.endsWith("/");
  let candidates = [isAbsolute(pattern.text) ? "/" : ""];

  for (const segment of segments(pattern)) {
    const next: string[] = [];
    const wild = segment.live.some(Boolean);
    for (const prefix of candidates) {
      if (!wild) {
        const path = join(prefix, segment.text);
        if (stat(vfs, fsCtx, path).ok) next.push(path);
        continue;
      }
      const listing = listDir(vfs, fsCtx, prefix === "" ? "." : prefix);
      if (!listing.ok) continue;
      const matcher = segmentMatcher(segment);
      // A leading dot must be typed: `*` never matches hidden files, or `.` and `..`.
      const showHidden = segment.text.startsWith(".") && !segment.live[0];
      for (const entry of listing.value) {
        if (entry.name.startsWith(".") && !showHidden) continue;
        if (matcher.test(entry.name)) next.push(join(prefix, entry.name));
      }
    }
    candidates = next;
    if (candidates.length === 0) return [];
  }

  const found = wantsDir
    ? candidates.filter((path) => {
        const info = stat(vfs, fsCtx, path);
        return info.ok && info.value.kind === "dir";
      })
    : candidates;
  return found
    .map((path) => (wantsDir ? `${path}/` : path))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
