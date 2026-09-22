/**
 * The tokenizer: text in, words and operators out. It understands the quoting rules of a real
 * shell (single quotes are literal, double quotes allow $VARIABLES, a backslash escapes one
 * character) and records, for every piece of every word, whether it was quoted, because that
 * decides whether `*` is a wildcard later.
 *
 * It's a pure function over the string. It never runs anything: this is input validation, the
 * same idea the platform teaches, turned on the terminal itself.
 */
import type { ShellWordPart } from "@/sim/types";
import type { ParseError, RedirectOperator, Span, WordNode } from "./types";

export const MAX_LINE_LENGTH = 4096;

export type ControlOperator = "|" | "||" | "&&" | ";";
export type Operator = ControlOperator | RedirectOperator;

export type Token =
  | {
      readonly kind: "word";
      readonly word: WordNode;
      /** Set when the word looks like `NAME=value`: whether it is one depends on where it sits. */
      readonly assignment?: { readonly name: string; readonly value: WordNode };
    }
  | ({ readonly kind: "op"; readonly op: Operator } & Span);

export type TokenizeResult =
  | { readonly ok: true; readonly tokens: readonly Token[]; readonly comment?: string }
  | { readonly ok: false; readonly error: ParseError };

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NAME_START = /[A-Za-z_]/;
const NAME_CHAR = /[A-Za-z0-9_]/;
const SPECIAL_VARIABLE = /[?$#0-9]/;
const USER_NAME = /^[a-z_][a-z0-9_-]*$/;
const WHITESPACE = /[ \t\n\r]/;
/** Characters that end an unquoted word. */
const METACHARACTERS = new Set(["|", "&", ";", "<", ">", "(", ")"]);

const quote = (text: string) => `\`${text}'`;

export function syntaxError(
  code: ParseError["code"],
  index: number,
  token: string,
): { ok: false; error: ParseError } {
  const message = {
    UNTERMINATED_QUOTE: `bash: unexpected EOF while looking for matching ${quote(token)}`,
    UNEXPECTED_TOKEN: `bash: syntax error near unexpected token ${quote(token)}`,
    UNEXPECTED_END:
      token === "newline"
        ? `bash: syntax error near unexpected token ${quote("newline")}`
        : "bash: syntax error: unexpected end of file",
    BAD_SUBSTITUTION: `bash: ${token}: bad substitution`,
    UNSUPPORTED_SYNTAX: `bash: ${token}: not available in this practice terminal`,
    LINE_TOO_LONG: `bash: line too long (over ${MAX_LINE_LENGTH} characters)`,
  }[code];
  return { ok: false, error: { code, column: index + 1, token, message } };
}

/** Builds a word's parts, merging neighbouring text with the same quoting. */
class PartsBuilder {
  readonly parts: ShellWordPart[] = [];

  text(value: string, quoted: boolean): void {
    if (value === "") return;
    const last = this.parts[this.parts.length - 1];
    if (last && "text" in last && last.quoted === quoted) {
      this.parts[this.parts.length - 1] = { text: last.text + value, quoted };
    } else {
      this.parts.push({ text: value, quoted });
    }
  }

  variable(name: string, quoted: boolean): void {
    this.parts.push({ variable: name, quoted });
  }

  tilde(user: string): void {
    this.parts.push({ tilde: user });
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }
}

export function tokenize(line: string): TokenizeResult {
  if (line.length > MAX_LINE_LENGTH) return syntaxError("LINE_TOO_LONG", MAX_LINE_LENGTH, "");
  const tokens: Token[] = [];
  let i = 0;

  const at = (offset = 0) => line[i + offset];

  while (i < line.length) {
    const char = at() as string;
    if (WHITESPACE.test(char)) {
      i++;
      continue;
    }
    // A comment runs to the end of the line.
    if (char === "#") return { ok: true, tokens, comment: line.slice(i + 1) };

    const operator = readOperator(line, i);
    if (operator) {
      if ("error" in operator) return { ok: false, error: operator.error };
      tokens.push({ kind: "op", op: operator.op, start: i, end: i + operator.length });
      i += operator.length;
      continue;
    }

    // A word: read until unquoted whitespace or a metacharacter.
    const start = i;
    const parts = new PartsBuilder();
    // For NAME=value: the parts after the first unquoted "=", while everything before it is a
    // plain unquoted name.
    let assignment: { name: string; valueStart: number; value: PartsBuilder } | undefined;
    let plainPrefix = ""; // unquoted literal text so far, while nothing else has appeared
    let prefixIsPlain = true;
    const builders = () => (assignment ? [parts, assignment.value] : [parts]);
    const addText = (value: string, quoted: boolean) => {
      for (const builder of builders()) builder.text(value, quoted);
      if (!assignment) {
        if (quoted) prefixIsPlain = false;
        else plainPrefix += value;
      }
    };

    // A leading, unquoted ~ means a home folder.
    const tilde = /^~([a-z_][a-z0-9_-]*)?(?=$|\/|[ \t|&;<>()])/.exec(line.slice(i));
    if (tilde && (tilde[1] === undefined || USER_NAME.test(tilde[1]))) {
      parts.tilde(tilde[1] ?? "");
      prefixIsPlain = false;
      i += tilde[0].length;
    }

    while (i < line.length) {
      const c = at() as string;
      if (WHITESPACE.test(c) || METACHARACTERS.has(c)) break;

      if (c === "=" && !assignment && prefixIsPlain && NAME.test(plainPrefix)) {
        parts.text("=", false);
        assignment = { name: plainPrefix, valueStart: i + 1, value: new PartsBuilder() };
        i++;
        continue;
      }
      if (c === "\\") {
        const next = at(1);
        if (next === undefined) return syntaxError("UNEXPECTED_END", i, "\\");
        addText(next, true); // an escaped character is never a wildcard
        i += 2;
        continue;
      }
      if (c === "'") {
        const close = line.indexOf("'", i + 1);
        if (close === -1) return syntaxError("UNTERMINATED_QUOTE", i, "'");
        addText(line.slice(i + 1, close), true);
        prefixIsPlain = false;
        i = close + 1;
        continue;
      }
      if (c === '"') {
        const result = readDoubleQuoted(
          line,
          i,
          (value) => addText(value, true),
          (name) => {
            for (const builder of builders()) builder.variable(name, true);
            prefixIsPlain = false;
          },
        );
        if (!result.ok) return result;
        prefixIsPlain = false;
        i = result.end;
        continue;
      }
      if (c === "$") {
        const variable = readVariable(line, i);
        if (!variable.ok) return variable;
        if (variable.name === undefined) addText("$", false);
        else {
          for (const builder of builders()) builder.variable(variable.name, false);
          prefixIsPlain = false;
        }
        i = variable.end;
        continue;
      }
      if (c === "`") return syntaxError("UNSUPPORTED_SYNTAX", i, "`...` (command substitution)");
      addText(c, false);
      i++;
    }

    // An empty pair of quotes is still a word: '' is an empty argument.
    const raw = line.slice(start, i);
    const wordParts = parts.empty && /['"]/.test(raw) ? [{ text: "", quoted: true }] : parts.parts;
    const word: WordNode = { parts: wordParts, raw, start, end: i };
    tokens.push({
      kind: "word",
      word,
      ...(assignment && {
        assignment: {
          name: assignment.name,
          value: {
            parts: assignment.value.parts,
            raw: line.slice(assignment.valueStart, i),
            start: assignment.valueStart,
            end: i,
          },
        },
      }),
    });
  }
  return { ok: true, tokens };
}

type OperatorResult =
  { readonly op: Operator; readonly length: number } | { readonly error: ParseError } | undefined;

function readOperator(line: string, i: number): OperatorResult {
  const rest = line.slice(i);
  const unsupported = (length: number, what: string) => ({
    error: syntaxError("UNSUPPORTED_SYNTAX", i, `${rest.slice(0, length)} (${what})`).error,
  });
  // Redirections that name a stream: 2>, 2>>, 2>&1, and 1> / 1>> (the same as > and >>).
  const numbered = /^([12])(>>|>&1|>&2|>&|>)/.exec(rest);
  if (numbered) {
    const [whole, fd, op] = numbered;
    if (fd === "2" && op === ">&1") return { op: "2>&1", length: whole.length };
    if (op === ">&" || op === ">&1" || op === ">&2")
      return unsupported(whole.length, "copying streams");
    if (fd === "1") return { op: op === ">>" ? ">>" : ">", length: whole.length };
    return { op: op === ">>" ? "2>>" : "2>", length: whole.length };
  }
  if (rest.startsWith("||")) return { op: "||", length: 2 };
  if (rest.startsWith("&&")) return { op: "&&", length: 2 };
  if (rest.startsWith("&>")) return unsupported(2, "sending both streams to a file");
  if (rest.startsWith("&")) return unsupported(1, "running in the background");
  if (rest.startsWith("|&")) return unsupported(2, "piping both streams");
  if (rest.startsWith("|")) return { op: "|", length: 1 };
  if (rest.startsWith(";")) return { op: ";", length: 1 };
  if (rest.startsWith("<<")) return unsupported(2, "here-documents");
  if (rest.startsWith("<(") || rest.startsWith(">(")) return unsupported(2, "process substitution");
  if (rest.startsWith("<")) return { op: "<", length: 1 };
  if (rest.startsWith(">>")) return { op: ">>", length: 2 };
  if (rest.startsWith(">&")) return unsupported(2, "copying streams");
  if (rest.startsWith(">|")) return { op: ">", length: 2 };
  if (rest.startsWith(">")) return { op: ">", length: 1 };
  if (rest.startsWith("(") || rest.startsWith(")")) return unsupported(1, "subshells");
  return undefined;
}

/** Reads `"..."` starting at the quote. Inside, \ escapes only $ ` " \ and a new line. */
function readDoubleQuoted(
  line: string,
  start: number,
  onText: (text: string) => void,
  onVariable: (name: string) => void,
): { ok: true; end: number } | { ok: false; error: ParseError } {
  let i = start + 1;
  let text = "";
  const flush = () => {
    onText(text);
    text = "";
  };
  while (i < line.length) {
    const c = line[i] as string;
    if (c === '"') {
      flush();
      return { ok: true, end: i + 1 };
    }
    if (c === "\\" && i + 1 < line.length && '$`"\\\n'.includes(line[i + 1] as string)) {
      text += line[i + 1];
      i += 2;
      continue;
    }
    if (c === "$") {
      const variable = readVariable(line, i);
      if (!variable.ok) return variable;
      if (variable.name === undefined) text += "$";
      else {
        flush();
        onVariable(variable.name);
      }
      i = variable.end;
      continue;
    }
    if (c === "`") return syntaxError("UNSUPPORTED_SYNTAX", i, "`...` (command substitution)");
    text += c;
    i++;
  }
  return syntaxError("UNTERMINATED_QUOTE", start, '"');
}

/**
 * Reads a variable reference at `$`: `$NAME`, `${NAME}`, or `$?`, `$$`, `$#`, `$0`-`$9`. A `$`
 * that isn't followed by a name is an ordinary character (`name` undefined).
 */
function readVariable(
  line: string,
  start: number,
): { ok: true; name?: string; end: number } | { ok: false; error: ParseError } {
  const next = line[start + 1];
  if (next === "(") {
    const what =
      line[start + 2] === "(" ? "$((...)) (arithmetic)" : "$(...) (command substitution)";
    return syntaxError("UNSUPPORTED_SYNTAX", start, what);
  }
  if (next === "{") {
    const close = line.indexOf("}", start + 2);
    if (close === -1) return syntaxError("BAD_SUBSTITUTION", start, line.slice(start));
    const inner = line.slice(start + 2, close);
    if (NAME.test(inner) || /^[?$#0-9]$/.test(inner))
      return { ok: true, name: inner, end: close + 1 };
    if (/^[A-Za-z_][A-Za-z0-9_]*[:#%/^,@[]/.test(inner)) {
      return syntaxError(
        "UNSUPPORTED_SYNTAX",
        start,
        `${line.slice(start, close + 1)} (changing a value)`,
      );
    }
    return syntaxError("BAD_SUBSTITUTION", start, line.slice(start, close + 1));
  }
  if (next !== undefined && SPECIAL_VARIABLE.test(next))
    return { ok: true, name: next, end: start + 2 };
  if (next !== undefined && NAME_START.test(next)) {
    let end = start + 2;
    while (end < line.length && NAME_CHAR.test(line[end] as string)) end++;
    return { ok: true, name: line.slice(start + 1, end), end };
  }
  return { ok: true, end: start + 1 };
}
