/**
 * A parsed command line, as data. The terminal (phase 05) turns what the learner typed into this
 * structure; the engine runs it. Nothing here is ever evaluated as code: every word is looked up in
 * the tool registry, and operators are fields, not syntax the engine re-reads. That's the
 * input-validation principle the platform teaches, applied to itself.
 *
 *   cat /var/log/auth.log | grep Failed > failed.txt && wc -l failed.txt
 *
 * is one ShellCommand with two list items: a two-command pipeline whose last command's output goes
 * to a file, then (only if that succeeded) `wc`.
 */

/**
 * One piece of a word. `"$HOME"/notes*.txt` is two parts: the quoted variable `HOME`, then the
 * unquoted text `/notes*.txt`. Quoting still matters after parsing: quoted text is never
 * glob-expanded, and a `~` only means "home folder" when it isn't quoted.
 */
export type ShellWordPart =
  | {
      /** Literal text. */
      readonly text: string;
      /** Inside quotes or escaped: `*`, `?` and `[` are ordinary characters. */
      readonly quoted: boolean;
    }
  | {
      /** A variable: `HOME` for `$HOME` or `${HOME}`, or a special one: `?`, `$`, `0`. */
      readonly variable: string;
      readonly quoted: boolean;
    }
  | {
      /** A leading, unquoted `~` (the current user's home) or `~name` (that user's home). */
      readonly tilde: string;
    };

export interface ShellWord {
  readonly parts: readonly ShellWordPart[];
}

/** `name=value` before a command (or alone), setting a variable. */
export interface ShellAssignment {
  readonly name: string;
  readonly value: ShellWord;
}

export interface ShellRedirect {
  /** 0 is input (`<`), 1 is output (`>`), 2 is errors (`2>`). */
  readonly fd: 0 | 1 | 2;
  /** `read` for `<`, `write` for `>` (replaces the file), `append` for `>>`. */
  readonly mode: "read" | "write" | "append";
  /** The file. Absent only for `2>&1`, which sends errors wherever output goes. */
  readonly target?: ShellWord;
}

/** One command and its arguments, with any redirections. */
export interface ShellSimpleCommand {
  readonly assignments: readonly ShellAssignment[];
  /** The command name, then its arguments. Empty for a line of only assignments. */
  readonly words: readonly ShellWord[];
  readonly redirects: readonly ShellRedirect[];
}

/** Commands joined by `|`: each one's output becomes the next one's input. */
export interface ShellPipeline {
  readonly commands: readonly ShellSimpleCommand[];
}

/**
 * When a pipeline runs, based on the previous one's exit status: `always` (the first, or after
 * `;`), `success` (after `&&`), or `failure` (after `||`).
 */
export type ShellCondition = "always" | "success" | "failure";

export interface ShellListItem {
  readonly when: ShellCondition;
  readonly pipeline: ShellPipeline;
}

/** A whole command line: pipelines joined by `;`, `&&` and `||`. */
export interface ShellCommand {
  readonly type: "shell";
  /** Exactly what the learner typed, for history and transcripts. */
  readonly line: string;
  readonly list: readonly ShellListItem[];
}
