import type { Rng } from "../core/rng";
import type { SimResult, SimState } from "../core/types";
import type { ArtefactRef } from "../evidence/types";

/**
 * Educational help for one tool, shown by `<tool> --help` and by `man <tool>`. Written for a
 * complete beginner first: a plain-language one-liner, then the detail, then why it matters.
 */
export interface ToolHelp {
  /** Readable in five seconds: what the tool does, in everyday words. */
  readonly oneLiner: string;
  readonly usage: readonly string[];
  /** Plain-language explanation, one paragraph per entry. Define every term on first use. */
  readonly description: readonly string[];
  readonly options?: readonly { readonly flags: string; readonly text: string }[];
  readonly examples?: readonly { readonly command: string; readonly text: string }[];
  /** Why this matters in security work, including the ethics of using it for real. */
  readonly concept: readonly string[];
  /**
   * Forensics addition (docs/plan/04-disk-tools.md): the real tools, menus and commands this
   * simulated one stands in for, named so a learner can look them up. Real tool names are allowed
   * here and nowhere else: the registry test bans them as command names.
   */
  readonly realWorld?: readonly string[];
  /**
   * The Learning Center lesson that teaches the idea behind this tool, by id
   * (docs/plan/13-learning-center.md: "each tool's man page links to its lesson"). The page prints
   * where to find it; tests/unit/content-references.test.ts checks the lesson exists.
   */
  readonly lesson?: string;
}

/**
 * What a beginner wants to do with a tool. Bare `help` and the terminal's cheat sheet group tools
 * this way, instead of alphabetically.
 */
export const TOOL_CATEGORIES = [
  "look-around",
  "read",
  "find",
  "change",
  "text",
  "system",
  "permissions",
  "network",
  "investigate",
  "help",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/** Each category's label, in words a beginner already knows. */
export const TOOL_CATEGORY_LABELS: Readonly<Record<ToolCategory, string>> = {
  "look-around": "Look around",
  read: "Read files",
  find: "Find things",
  change: "Change files and folders",
  text: "Work with text",
  system: "Who and where you are",
  permissions: "Permissions",
  network: "Explore the network",
  investigate: "Investigate",
  help: "Get help",
};

/** What a tool gets besides its arguments and the state. Built fresh by `step` for every command. */
export interface ToolContext {
  /** Seeded from the run's seed and this command's tick. */
  readonly rng: Rng;
  /** This command's time, read once from the injected clock. */
  readonly now: number;
  /** The command number this run is on (state.tick after this command). */
  readonly tick: number;
  /** Text piped in, if any. */
  readonly stdin?: string;
  /**
   * Forensics addition (docs/plan/07-carve-strings-logq.md): the artefact ref each piped-in line
   * carried, by line number, so a filter like `grep` can keep it on the lines it passes through.
   */
  readonly stdinRefs?: readonly (ArtefactRef | undefined)[];
  /**
   * The output goes straight to the learner's screen: not into a pipe or a file. Tools like `ls`
   * and `grep` only add colour then, like real ones. Always false for `exec` commands, so tests
   * and golden transcripts stay plain text.
   */
  readonly tty: boolean;
  /** Every command, for tools that run or describe others (`sudo`, `man`, `help`). */
  readonly registry: ToolRegistry;
}

/**
 * A simulated tool: a pure function from arguments and state to a result. Network and security
 * tools never borrow a real tool's name, and their output is representative rather than a copy of
 * any real tool's.
 */
export interface Tool {
  readonly name: string;
  readonly category: ToolCategory;
  readonly help: ToolHelp;
  readonly run: (args: readonly string[], state: SimState, ctx: ToolContext) => SimResult;
}

/** A tool as a list entry: its name, its help's one-liner, and what it's for. */
export interface ToolSummary {
  readonly name: string;
  readonly summary: string;
  readonly category: ToolCategory;
}

export interface ToolRegistry {
  get(name: string): Tool | undefined;
  has(name: string): boolean;
  /** Tool names, sorted. */
  names(): readonly string[];
}
