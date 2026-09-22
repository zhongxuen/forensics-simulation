/**
 * Turns the patterns grep and sed take into JavaScript regular expressions. The learner's pattern
 * becomes a RegExp object that only ever matches text: it's data for the matcher, never code.
 *
 * - basic (the default, "BRE"): `+ ? | ( ) { }` are ordinary characters unless written with a
 *   backslash, like GNU grep
 * - extended (`-E`, "ERE"): they're special without one
 * - fixed (`-F`): nothing is special at all
 *
 * Both understand POSIX classes like `[[:digit:]]` and the word edges `\<` and `\>`.
 */

/** Longer patterns are refused, which also keeps a pathological pattern from running for long. */
export const MAX_PATTERN_LENGTH = 256;

export type RegexFlavor = "basic" | "extended" | "fixed";

const POSIX_CLASSES: Readonly<Record<string, string>> = {
  alpha: "A-Za-z",
  digit: "0-9",
  alnum: "A-Za-z0-9",
  upper: "A-Z",
  lower: "a-z",
  space: "\\s",
  blank: " \\t",
  punct: "!-\\/:-@\\[-`{-~",
  xdigit: "0-9A-Fa-f",
  word: "\\w",
};

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** The JavaScript source for a pattern, or undefined if it can't be read. */
export function translatePattern(pattern: string, flavor: RegexFlavor): string | undefined {
  if (flavor === "fixed") return escapeRegex(pattern);
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i] as string;
    if (char === "\\") {
      const next = pattern[i + 1];
      i++;
      if (next === undefined) return undefined; // a trailing backslash
      if (next === "<" || next === ">") out += "\\b";
      else if ("()|{}+?".includes(next)) out += flavor === "basic" ? next : `\\${next}`;
      else if ("wWsSbB".includes(next)) out += `\\${next}`;
      else if (/[1-9]/.test(next)) out += `\\${next}`;
      else out += escapeRegex(next);
      continue;
    }
    if (char === "[") {
      // A bracket expression: copy it through, translating [:class:] names.
      let j = i + 1;
      let body = "";
      if (pattern[j] === "^") {
        body += "^";
        j++;
      }
      if (pattern[j] === "]") {
        body += "\\]";
        j++;
      }
      let closed = false;
      while (j < pattern.length) {
        const c = pattern[j] as string;
        if (c === "]") {
          closed = true;
          break;
        }
        const posix = /^\[:([a-z]+):\]/.exec(pattern.slice(j));
        if (posix) {
          const range = POSIX_CLASSES[posix[1] as string];
          if (range === undefined) return undefined;
          body += range;
          j += posix[0].length;
          continue;
        }
        body += c === "\\" || c === "[" ? `\\${c}` : c;
        j++;
      }
      if (!closed) return undefined;
      out += `[${body}]`;
      i = j;
      continue;
    }
    if ("()|{}+?".includes(char)) {
      out += flavor === "basic" ? `\\${char}` : char;
      continue;
    }
    if (char === "*" && (out === "" || out === "^")) {
      out += "\\*"; // a leading * is an ordinary character
      continue;
    }
    if (char === "/") {
      out += "\\/";
      continue;
    }
    out += char;
  }
  return out;
}

export interface PatternOptions {
  readonly flavor: RegexFlavor;
  readonly ignoreCase?: boolean;
  /** Match whole words only (grep -w). */
  readonly word?: boolean;
  /** Match whole lines only (grep -x). */
  readonly line?: boolean;
  readonly global?: boolean;
}

/** A compiled pattern, or undefined when it's too long or can't be read. */
export function compilePattern(pattern: string, options: PatternOptions): RegExp | undefined {
  if (pattern.length > MAX_PATTERN_LENGTH) return undefined;
  let source = translatePattern(pattern, options.flavor);
  if (source === undefined) return undefined;
  if (options.word) source = `(?<![\\w])(?:${source})(?![\\w])`;
  if (options.line) source = `^(?:${source})$`;
  try {
    return new RegExp(source, `${options.ignoreCase ? "i" : ""}${options.global ? "g" : ""}`);
  } catch {
    return undefined;
  }
}
