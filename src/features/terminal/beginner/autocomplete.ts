/**
 * Tab completion and ghost text: finishing command names and file names the way a real shell
 * does, from the tool registry and what the learner can see on this machine.
 */
import { completeCommandName, completePath, defaultRegistry } from "@/sim";
import type { SimState, ToolRegistry } from "@/sim/types";
import { completionContext, escapeForShell, unescapeWord } from "../parser";

export interface Completion {
  /** The new input line and cursor position. Unchanged when there was nothing to add. */
  readonly input: string;
  readonly cursor: number;
  /** When several names fit and nothing more could be filled in: the choices, to show. */
  readonly choices: readonly string[];
}

const commonPrefix = (items: readonly string[]): string => {
  if (items.length === 0) return "";
  let prefix = items[0] as string;
  for (const item of items.slice(1)) {
    while (!item.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
};

function candidatesFor(
  input: string,
  cursor: number,
  sim: SimState,
  registry: ToolRegistry,
): { start: number; prefix: string; candidates: string[] } | undefined {
  const context = completionContext(input, cursor);
  if (context.inQuote) return undefined;
  const typed = unescapeWord(context.prefix);
  const candidates = context.isCommand
    ? completeCommandName(registry, typed)
    : completePath(sim, typed);
  return { start: context.start, prefix: context.prefix, candidates };
}

/** What Tab does at `cursor`: fill in the one match, the shared start of several, or list them. */
export function completeAtCursor(
  input: string,
  cursor: number,
  sim: SimState,
  registry: ToolRegistry = defaultRegistry,
): Completion {
  const unchanged = { input, cursor, choices: [] };
  const found = candidatesFor(input, cursor, sim, registry);
  if (!found || found.candidates.length === 0) return unchanged;
  const { start, candidates } = found;
  const apply = (text: string) => {
    const next = `${input.slice(0, start)}${text}${input.slice(cursor)}`;
    return { input: next, cursor: start + text.length, choices: [] };
  };
  if (candidates.length === 1) {
    const only = candidates[0] as string;
    // A finished name gets a space after it, ready for the next word; a folder keeps its slash.
    return apply(`${escapeForShell(only)}${only.endsWith("/") ? "" : " "}`);
  }
  const shared = escapeForShell(commonPrefix(candidates));
  if (shared.length > found.prefix.length) return apply(shared);
  // Show names the way ls would: without the folders typed so far.
  const shown = candidates.map((candidate) => candidate.replace(/^.*\/(?=.)/, ""));
  return { input, cursor, choices: shown };
}

/**
 * Ghost text: a faint suggestion after the cursor that Tab (or the right arrow) accepts. It comes
 * from, in order: a "did you mean" fix for an empty prompt, an earlier command that starts the
 * same way, or the one file or command name that fits.
 */
export function ghostSuggestion(
  input: string,
  cursor: number,
  sim: SimState,
  history: readonly string[],
  fixedLine?: string,
  registry: ToolRegistry = defaultRegistry,
): string {
  if (input === "") return fixedLine ?? "";
  if (cursor !== input.length) return "";
  for (let i = history.length - 1; i >= 0; i--) {
    const earlier = history[i] as string;
    if (earlier.length > input.length && earlier.startsWith(input))
      return earlier.slice(input.length);
  }
  const found = candidatesFor(input, cursor, sim, registry);
  if (!found || found.candidates.length !== 1 || found.prefix === "") return "";
  const completion = escapeForShell(found.candidates[0] as string);
  return completion.startsWith(found.prefix) ? completion.slice(found.prefix.length) : "";
}

/** The newest earlier command containing `query`, searching back from `before`. For Ctrl+R. */
export function reverseSearch(
  history: readonly string[],
  query: string,
  before: number = history.length,
): { index: number; line: string } | undefined {
  if (query === "") return undefined;
  for (let i = Math.min(before, history.length) - 1; i >= 0; i--) {
    const line = history[i] as string;
    if (line.includes(query)) return { index: i, line };
  }
  return undefined;
}
