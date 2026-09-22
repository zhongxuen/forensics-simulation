/**
 * Path resolution, the way a kernel does it: one component at a time, checking search (x)
 * permission on every directory passed through, following symlinks up to a depth limit, and never
 * letting ".." climb above "/". Every expected failure comes back as a typed error.
 */
import { err, ok, type Result } from "../core/result";
import type { FsError } from "../core/errors";
import { isAbsolute, splitPath } from "./path";
import { canAccess } from "./perms";
import { childOf } from "./tree";
import type { DirNode, FsActor, Vfs, VfsNode } from "./types";

/** Like Linux's limit: past this many symlinks in one lookup, give up with ELOOP. */
export const MAX_SYMLINK_DEPTH = 40;

export interface Resolved {
  readonly node: VfsNode;
  /** Canonical path components from the root: no ".", "..", or symlinks. */
  readonly parts: readonly string[];
}

export interface ResolveOptions {
  /** Follow a symlink in the final component (stat vs lstat). Default true. */
  readonly follow?: boolean;
}

/** Resolves `path` (absolute, or relative to the canonical `cwd`) to a node. */
export function resolvePath(
  vfs: Vfs,
  actor: FsActor,
  cwd: string,
  path: string,
  options: ResolveOptions = {},
): Result<Resolved, FsError> {
  const fail = (code: FsError["code"]) => err<FsError>({ code, path });
  if (path.length === 0) return fail("ENOENT");

  // A trailing slash means "this must be a directory", which also follows a final symlink.
  const mustBeDir = path.length > 1 && path.endsWith("/");
  const follow = (options.follow ?? true) || mustBeDir;

  // Each entry is a directory we're inside, from the root down.
  let stack: { name: string; node: VfsNode }[] = [];
  if (!isAbsolute(path)) {
    const start = walkCanonical(vfs.root, splitPath(cwd));
    if (!start) return fail("ENOENT"); // the working directory itself was deleted
    stack = start;
  }

  let queue = splitPath(path);
  let links = 0;
  while (queue.length > 0) {
    const [name, ...rest] = queue as [string, ...string[]];
    queue = rest;
    if (name === ".") continue;
    if (name === "..") {
      stack.pop(); // popping at the root leaves us at the root, like the kernel
      continue;
    }
    const dir: VfsNode = stack[stack.length - 1]?.node ?? vfs.root;
    if (dir.kind !== "dir") return fail("ENOTDIR");
    if (!canAccess(actor, dir, "x")) return fail("EACCES");
    const child = childOf(dir, name);
    if (!child) return fail("ENOENT");

    const isLast = queue.length === 0;
    if (child.kind === "symlink" && (!isLast || follow)) {
      if (++links > MAX_SYMLINK_DEPTH) return fail("ELOOP");
      if (child.target.length === 0) return fail("ENOENT");
      if (isAbsolute(child.target)) stack = [];
      queue = [...splitPath(child.target), ...queue];
      continue;
    }
    if (!isLast && child.kind === "file") return fail("ENOTDIR");
    stack.push({ name, node: child });
  }

  const node = stack[stack.length - 1]?.node ?? vfs.root;
  if (mustBeDir && node.kind !== "dir") return fail("ENOTDIR");
  return ok({ node, parts: stack.map((entry) => entry.name) });
}

export interface ResolvedParent {
  readonly dir: DirNode;
  /** Canonical path of `dir`. */
  readonly dirParts: readonly string[];
  /** The final component, exactly as typed. */
  readonly name: string;
}

/**
 * Resolves everything except the final component, for operations that create, remove, or rename
 * an entry. The final name is returned as typed, without looking it up.
 */
export function resolveParent(
  vfs: Vfs,
  actor: FsActor,
  cwd: string,
  path: string,
): Result<ResolvedParent, FsError> {
  const parts = splitPath(path);
  const name = parts[parts.length - 1];
  if (name === undefined) {
    return err({ code: path.length === 0 ? "ENOENT" : "EBUSY", path, detail: "root" });
  }
  if (name === "." || name === "..") return err({ code: "EINVAL", path, detail: "dot-path" });

  const parentPath = parts.slice(0, -1).join("/");
  const parent = resolvePath(
    vfs,
    actor,
    cwd,
    isAbsolute(path) ? `/${parentPath}` : parentPath || ".",
  );
  if (!parent.ok) return err({ ...parent.error, path });
  if (parent.value.node.kind !== "dir") return err({ code: "ENOTDIR", path });
  return ok({ dir: parent.value.node, dirParts: parent.value.parts, name });
}

/** Walks a canonical path with no permission checks; `undefined` if any part is missing. */
function walkCanonical(
  root: DirNode,
  parts: readonly string[],
): { name: string; node: VfsNode }[] | undefined {
  const stack: { name: string; node: VfsNode }[] = [];
  let node: VfsNode = root;
  for (const name of parts) {
    if (node.kind !== "dir") return undefined;
    const child = childOf(node, name);
    if (!child) return undefined;
    stack.push({ name, node: child });
    node = child;
  }
  return node.kind === "dir" ? stack : undefined;
}
