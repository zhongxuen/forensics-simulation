/**
 * Read-only questions the terminal asks about a state, for its beginner layer: Tab completion,
 * "did you mean", and suggested next commands. They look at the filesystem exactly as the
 * session's user can see it (permissions apply), and never change anything.
 */
import { sessionFs } from "../core/session";
import type { SimState } from "../core/types";
import { listDir, readFile, stat } from "../fs/ops";
import { formatArgv } from "../core/output";
import type { ToolRegistry } from "../tools/types";

/**
 * How many single-character edits (insert, delete, change, or swap two neighbours) turn `a` into
 * `b`. "sl" is 1 away from "ls".
 */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number) => d[i]?.[j] ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      (d[i] as number[])[j] = best;
    }
  }
  return at(rows - 1, cols - 1);
}

/**
 * The candidates nearest to `word`, closest first (ties keep the candidates' order). Short words
 * allow one edit, longer ones two, so "ca" doesn't suggest everything. A match that differs only
 * in capital letters always counts.
 */
export function closestMatches(
  word: string,
  candidates: readonly string[],
  maxDistance = word.length <= 3 ? 1 : 2,
): string[] {
  const lower = word.toLowerCase();
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      distance:
        candidate.toLowerCase() === lower ? 0.5 : editDistance(lower, candidate.toLowerCase()),
    }))
    .filter(({ candidate, distance }) => candidate !== word && distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .map(({ candidate }) => candidate);
}

/** Command names starting with `prefix`, sorted. */
export function completeCommandName(registry: ToolRegistry, prefix: string): string[] {
  return registry.names().filter((name) => name.startsWith(prefix));
}

const homeOf = (state: SimState): string => {
  const { env } = state.session;
  return Object.hasOwn(env, "HOME") ? (env.HOME as string) : "/";
};

/** `~` and `~/x` as the paths they stand for, for looking things up. */
function expandTilde(path: string, state: SimState): string {
  if (path === "~") return homeOf(state);
  if (path.startsWith("~/")) return `${homeOf(state)}${path.slice(1)}`;
  return path;
}

/**
 * Completions for a partly typed path, as whole words: "no" in a folder holding notes.txt gives
 * ["notes.txt"], "/et" gives ["/etc/"]. Folders end in "/". Hidden files only show up when the
 * name typed so far starts with a dot.
 */
export function completePath(
  state: SimState,
  partial: string,
  options: { readonly dirsOnly?: boolean } = {},
): string[] {
  const { vfs, ctx } = sessionFs(state, 0);
  const slash = partial.lastIndexOf("/");
  const dirPart = slash === -1 ? "" : partial.slice(0, slash + 1);
  const namePrefix = slash === -1 ? partial : partial.slice(slash + 1);
  if (partial === "~") return ["~/"];
  const listing = listDir(vfs, ctx, dirPart === "" ? "." : expandTilde(dirPart, state));
  if (!listing.ok) return [];
  const results: string[] = [];
  for (const entry of listing.value) {
    if (!entry.name.startsWith(namePrefix)) continue;
    if (entry.name.startsWith(".") && !namePrefix.startsWith(".")) continue;
    const full = `${dirPart}${entry.name}`;
    const target = stat(vfs, ctx, expandTilde(full, state));
    const isDir = target.ok && target.value.kind === "dir";
    if (options.dirsOnly && !isDir) continue;
    results.push(isDir ? `${full}/` : full);
  }
  return results;
}

/**
 * For a path that doesn't exist: the same path with its first missing part replaced by the
 * closest real name in that folder, if one is close enough and the result exists. "note.txt"
 * becomes "notes.txt"; "/ect/passwd" becomes "/etc/passwd".
 */
export function suggestPath(state: SimState, path: string): string | undefined {
  const { vfs, ctx } = sessionFs(state, 0);
  const lookup = (p: string) => expandTilde(p, state);
  if (path === "" || stat(vfs, ctx, lookup(path)).ok) return undefined;
  const trailing = path.length > 1 && path.endsWith("/");
  const parts = path.split("/");
  let prefix = path.startsWith("/") ? "/" : "";
  let fixed = false;
  const join = (base: string, name: string) =>
    base === "" ? name : base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
  for (const part of parts) {
    if (part === "") continue;
    const candidate = join(prefix, part);
    if (
      part === "." ||
      part === ".." ||
      part.startsWith("~") ||
      stat(vfs, ctx, lookup(candidate)).ok
    ) {
      prefix = candidate;
      continue;
    }
    const listing = listDir(vfs, ctx, prefix === "" ? "." : lookup(prefix));
    if (!listing.ok) return undefined;
    const best = closestMatches(
      part,
      listing.value.map((entry) => entry.name),
    )[0];
    if (best === undefined) return undefined;
    prefix = join(prefix, best);
    fixed = true;
  }
  if (!fixed || !stat(vfs, ctx, lookup(prefix)).ok) return undefined;
  return trailing ? `${prefix}/` : prefix;
}

/**
 * A few commands worth trying next, for the terminal's clickable chips: look around, step into a
 * folder, read a file. Built from what's actually here, so they always work.
 */
export function suggestNextCommands(state: SimState, limit = 5): string[] {
  const { vfs, ctx } = sessionFs(state, 0);
  const suggestions = ["ls"];
  const listing = listDir(vfs, ctx, ".");
  if (listing.ok) {
    const visible = listing.value.filter((entry) => !entry.name.startsWith("."));
    const dirs = visible.filter((entry) => {
      const target = stat(vfs, ctx, entry.name);
      return target.ok && target.value.kind === "dir";
    });
    const files = visible.filter((entry) => {
      const target = stat(vfs, ctx, entry.name);
      return target.ok && target.value.kind === "file" && readFile(vfs, ctx, entry.name).ok;
    });
    const file = files[0];
    const dir = dirs[0];
    if (file) suggestions.push(formatArgv(["cat", file.name]));
    if (dir) suggestions.push(formatArgv(["cd", dir.name]));
    if (listing.value.some((entry) => entry.name.startsWith("."))) suggestions.push("ls -a");
  }
  if (state.session.cwd !== homeOf(state)) suggestions.push("cd ~");
  // "help" always makes the cut.
  return [...[...new Set(suggestions)].slice(0, Math.max(0, limit - 1)), "help"];
}
