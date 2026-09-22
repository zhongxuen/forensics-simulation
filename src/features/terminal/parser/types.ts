/**
 * The command-line syntax tree. The parser turns text into this; `toShellCommand` (lower.ts) turns
 * it into the engine's ShellCommand. Nothing here is ever evaluated as code.
 */
import type { ShellCondition, ShellWordPart } from "@/sim/types";

/** Where something is in the line: 0-based, end exclusive. */
export interface Span {
  readonly start: number;
  readonly end: number;
}

export interface WordNode extends Span {
  readonly parts: readonly ShellWordPart[];
  /** Exactly as typed, quotes and all. */
  readonly raw: string;
}

export interface AssignmentNode extends Span {
  readonly name: string;
  readonly value: WordNode;
}

export type RedirectOperator = "<" | ">" | ">>" | "2>" | "2>>" | "2>&1";

export interface RedirectNode extends Span {
  readonly op: RedirectOperator;
  readonly target?: WordNode;
}

export interface CommandNode extends Span {
  readonly assignments: readonly AssignmentNode[];
  readonly words: readonly WordNode[];
  readonly redirects: readonly RedirectNode[];
}

export interface PipelineNode extends Span {
  readonly commands: readonly CommandNode[];
}

export interface ListItemNode {
  readonly when: ShellCondition;
  /** The operator before this item: `&&`, `||` or `;`. Absent for the first. */
  readonly operator?: "&&" | "||" | ";";
  readonly pipeline: PipelineNode;
}

export interface CommandLineNode {
  readonly items: readonly ListItemNode[];
  /** Text after an unquoted `#`, if any. */
  readonly comment?: string;
}

/**
 * Every way a line can fail to parse. Codes are stable: the beginner layer has an explanation for
 * each one, and a test checks that none is missing.
 */
export const PARSE_ERROR_CODES = [
  "UNTERMINATED_QUOTE", // a ' or " that never closes
  "UNEXPECTED_TOKEN", // an operator where a command should be: `| ls`, `ls && && ls`
  "UNEXPECTED_END", // the line stops where more was needed: `ls |`, `ls >`
  "BAD_SUBSTITUTION", // ${...} that isn't a variable name
  "UNSUPPORTED_SYNTAX", // real shell syntax this practice terminal doesn't have: `&`, `$(...)`
  "LINE_TOO_LONG",
] as const;

export type ParseErrorCode = (typeof PARSE_ERROR_CODES)[number];

export interface ParseError {
  readonly code: ParseErrorCode;
  /** 1-based column of the problem, for pointing at it. */
  readonly column: number;
  /** The offending text: the quote, the token, or the feature. */
  readonly token: string;
  /** The line a real shell would print. */
  readonly message: string;
}

export type ParseResult =
  | { readonly ok: true; readonly ast: CommandLineNode }
  | { readonly ok: false; readonly error: ParseError };
