/**
 * Where the cursor is in a half-typed line, for Tab completion and ghost text: the word being
 * typed, where it starts, and whether it's a command name or an argument. Unlike the parser, this
 * never fails: a line being typed is usually incomplete.
 */

export interface CompletionContext {
  /** Index where the word under the cursor starts. */
  readonly start: number;
  /** The word so far, as typed (up to the cursor). */
  readonly prefix: string;
  /** The word names a command (first in a command, or after sudo, man or help). */
  readonly isCommand: boolean;
  /** Inside an open quote: completion leaves it alone. */
  readonly inQuote: boolean;
}

/** Words after which the next word is a command name. */
const COMMAND_AFTER = new Set(["sudo", "man", "help"]);

export function completionContext(line: string, cursor: number = line.length): CompletionContext {
  const before = line.slice(0, cursor);
  let quote: string | undefined;
  let wordStart = 0;
  // Words finished before the current one, since the last operator.
  let words: string[] = [];
  let current = "";
  for (let i = 0; i < before.length; i++) {
    const c = before[i] as string;
    if (quote) {
      if (c === quote) quote = undefined;
      current += c;
      continue;
    }
    if (c === "\\" && i + 1 < before.length) {
      current += c + before[i + 1];
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      current += c;
      continue;
    }
    if (c === " " || c === "\t") {
      if (current) words.push(current);
      current = "";
      wordStart = i + 1;
      continue;
    }
    if ("|;&<>".includes(c)) {
      if (current) words.push(current);
      current = "";
      wordStart = i + 1;
      // After a redirection, the next word is a file; after a separator, a command.
      words = "<>".includes(c) ? ["(redirect)"] : [];
      continue;
    }
    current += c;
  }
  const assignments = words.filter((w) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
  const real = words.slice(assignments.length);
  const isCommand =
    real.length === 0 || (real.length === 1 && COMMAND_AFTER.has(real[0] as string));
  return {
    start: wordStart,
    prefix: before.slice(wordStart),
    isCommand,
    inQuote: quote !== undefined,
  };
}

/**
 * A name ready to type: spaces and shell characters get a backslash. A `~` is left alone: it only
 * means "home" at the start of a word, which is where completion keeps the one you typed.
 */
export function escapeForShell(name: string): string {
  return name.replace(/([ \t'"\\$`|&;<>()*?[\]])/g, "\\$1");
}

/** The prefix as the name it spells, with backslash escapes and quotes removed. */
export function unescapeWord(word: string): string {
  return word.replace(/\\(.)/g, "$1").replace(/['"]/g, "");
}
