/**
 * Filesystem operations. Each one takes a Vfs and returns a new Vfs (or a value) or a typed error;
 * none of them throws for anything a learner can cause. Permission checks follow POSIX: the
 * learner's user can't read /etc/shadow for the same reason a real one can't.
 */
import { err, ok, type Result } from "../core/result";
import type { FsError } from "../core/errors";
import { hasGroup, hasUser } from "./accounts";
import { DEFAULT_DIR_MODE, DEFAULT_FILE_MODE, MODE_MASK, SETGID, UMASK } from "./mode";
import { isAbsolute, isValidName, joinPath, splitPath } from "./path";
import { canAccess, canModifyEntries, isRoot, stickyAllows } from "./perms";
import { resolveParent, resolvePath } from "./resolve";
import { byteLength, childNames, childOf, nodeAt, replaceNode, setEntry } from "./tree";
import type { Accounts, DirNode, FileNode, FsActor, StatInfo, Vfs, VfsNode } from "./types";

/** Who is acting, where they are, and what time it is (for mtimes). */
export interface FsContext {
  readonly actor: FsActor;
  /** Canonical absolute working directory. */
  readonly cwd: string;
  readonly now: number;
}

export type FsResult<T> = Result<T, FsError>;

/**
 * The largest file the simulation will write, in characters. Real disks fill up too; this keeps a
 * loop like `cat f >> f` from eating the browser's memory.
 */
export const MAX_FILE_CHARS = 1_000_000;

const fail = (code: FsError["code"], path: string, detail?: FsError["detail"]) =>
  err<FsError>(detail ? { code, path, detail } : { code, path });

const resolve = (vfs: Vfs, ctx: FsContext, path: string, follow = true) =>
  resolvePath(vfs, ctx.actor, ctx.cwd, path, { follow });

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

export function statOf(node: VfsNode, parts: readonly string[]): StatInfo {
  const base = {
    path: joinPath(parts),
    name: parts[parts.length - 1] ?? "/",
    kind: node.kind,
    owner: node.owner,
    group: node.group,
    mode: node.mode,
    mtime: node.mtime,
  };
  switch (node.kind) {
    case "file":
      return { ...base, size: byteLength(node.content) };
    case "dir":
      return { ...base, size: 4096 };
    case "symlink":
      return { ...base, size: byteLength(node.target), target: node.target };
  }
}

/** `stat` (follows a final symlink) or, with `follow: false`, `lstat`. */
export function stat(
  vfs: Vfs,
  ctx: FsContext,
  path: string,
  options: { readonly follow?: boolean } = {},
): FsResult<StatInfo> {
  const found = resolve(vfs, ctx, path, options.follow ?? true);
  return found.ok ? ok(statOf(found.value.node, found.value.parts)) : found;
}

/** The canonical absolute path, with every symlink followed. */
export function realpath(vfs: Vfs, ctx: FsContext, path: string): FsResult<string> {
  const found = resolve(vfs, ctx, path);
  return found.ok ? ok(joinPath(found.value.parts)) : found;
}

export function readFile(vfs: Vfs, ctx: FsContext, path: string): FsResult<string> {
  const found = resolve(vfs, ctx, path);
  if (!found.ok) return found;
  const { node } = found.value;
  if (node.kind === "dir") return fail("EISDIR", path);
  if (node.kind !== "file" || !canAccess(ctx.actor, node, "r")) return fail("EACCES", path);
  return ok(node.content);
}

/** A directory's entries (as lstat info), sorted by name. Reading a directory needs `r`. */
export function listDir(vfs: Vfs, ctx: FsContext, path: string): FsResult<readonly StatInfo[]> {
  const found = resolve(vfs, ctx, path);
  if (!found.ok) return found;
  const { node, parts } = found.value;
  if (node.kind !== "dir") return fail("ENOTDIR", path);
  if (!canAccess(ctx.actor, node, "r")) return fail("EACCES", path);
  return ok(
    childNames(node).map((name) => statOf(childOf(node, name) as VfsNode, [...parts, name])),
  );
}

// ---------------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------------

/** Writes (or with `append`, appends to) a file, creating it if needed. Follows symlinks. */
export function writeFile(
  vfs: Vfs,
  ctx: FsContext,
  path: string,
  content: string,
  options: { readonly append?: boolean } = {},
): FsResult<Vfs> {
  const found = resolve(vfs, ctx, path);
  if (found.ok) {
    const { node, parts } = found.value;
    if (node.kind === "dir") return fail("EISDIR", path);
    if (node.kind !== "file" || !canAccess(ctx.actor, node, "w")) return fail("EACCES", path);
    const next: FileNode = {
      ...node,
      content: options.append ? node.content + content : content,
      mtime: ctx.now,
    };
    if (next.content.length > MAX_FILE_CHARS) return fail("EFBIG", path);
    return ok({ root: replaceNode(vfs.root, parts, next) });
  }
  if (found.error.code !== "ENOENT") return found;
  if (content.length > MAX_FILE_CHARS) return fail("EFBIG", path);

  const parent = resolveParent(vfs, ctx.actor, ctx.cwd, path);
  if (!parent.ok) return parent;
  const { dir, dirParts, name } = parent.value;
  if (childOf(dir, name)) return fail("ENOENT", path); // a dangling symlink
  if (!canModifyEntries(ctx.actor, dir)) return fail("EACCES", path);
  if (!isValidName(name)) return fail("EINVAL", path, "bad-name");
  const file: FileNode = {
    kind: "file",
    content,
    ...newOwnership(ctx.actor, dir),
    mode: DEFAULT_FILE_MODE,
    mtime: ctx.now,
  };
  return ok({ root: setEntry(vfs.root, dirParts, name, file, ctx.now) });
}

/**
 * `touch`: creates an empty file, or marks an existing one as changed now. Updating the time needs
 * write permission, or owning the file, like the real thing.
 */
export function touch(vfs: Vfs, ctx: FsContext, path: string): FsResult<Vfs> {
  const found = resolve(vfs, ctx, path);
  if (!found.ok) return found.error.code === "ENOENT" ? writeFile(vfs, ctx, path, "") : found;
  const { node, parts } = found.value;
  const mayTouch =
    isRoot(ctx.actor) || ctx.actor.user === node.owner || canAccess(ctx.actor, node, "w");
  if (!mayTouch) return fail("EACCES", path);
  return ok({ root: replaceNode(vfs.root, parts, { ...node, mtime: ctx.now }) });
}

/** Creates a directory. With `parents`, creates missing parents and accepts an existing directory. */
export function mkdir(
  vfs: Vfs,
  ctx: FsContext,
  path: string,
  options: { readonly parents?: boolean; readonly mode?: number } = {},
): FsResult<Vfs> {
  if (options.parents) return mkdirParents(vfs, ctx, path, options.mode);
  const existing = resolve(vfs, ctx, path, false);
  if (existing.ok) return fail("EEXIST", path);
  if (existing.error.code !== "ENOENT") return existing;

  const parent = resolveParent(vfs, ctx.actor, ctx.cwd, path);
  if (!parent.ok) return parent;
  const { dir, dirParts, name } = parent.value;
  if (childOf(dir, name)) return fail("EEXIST", path); // a dangling symlink is still an entry
  if (!canModifyEntries(ctx.actor, dir)) return fail("EACCES", path);
  if (!isValidName(name)) return fail("EINVAL", path, "bad-name");
  const created: DirNode = {
    kind: "dir",
    children: {},
    ...newOwnership(ctx.actor, dir),
    mode: ((options.mode ?? DEFAULT_DIR_MODE) & ~UMASK & MODE_MASK) | (dir.mode & SETGID),
    mtime: ctx.now,
  };
  return ok({ root: setEntry(vfs.root, dirParts, name, created, ctx.now) });
}

function mkdirParents(vfs: Vfs, ctx: FsContext, path: string, mode?: number): FsResult<Vfs> {
  const parts = splitPath(path);
  let current = vfs;
  for (let i = 0; i < parts.length; i++) {
    const prefix = (isAbsolute(path) ? "/" : "") + parts.slice(0, i + 1).join("/");
    const found = resolve(current, ctx, prefix);
    if (found.ok) {
      if (found.value.node.kind === "dir") continue;
      return fail(i === parts.length - 1 ? "EEXIST" : "ENOTDIR", path);
    }
    if (found.error.code !== "ENOENT") return fail(found.error.code, path);
    const made = mkdir(current, ctx, prefix, mode === undefined ? {} : { mode });
    if (!made.ok) return fail(made.error.code, path, made.error.detail);
    current = made.value;
  }
  return ok(current);
}

/**
 * Removes a file, symlink, or (with `recursive`) a directory and everything in it. With `force`, a
 * missing path is not an error. All or nothing: if any part can't be removed, nothing is.
 */
export function rm(
  vfs: Vfs,
  ctx: FsContext,
  path: string,
  options: { readonly recursive?: boolean; readonly force?: boolean } = {},
): FsResult<Vfs> {
  const last = splitPath(path).at(-1);
  if (last === "." || last === "..") return fail("EINVAL", path, "dot-path");
  const found = resolve(vfs, ctx, path, false);
  if (!found.ok) {
    return options.force && found.error.code === "ENOENT" ? ok(vfs) : found;
  }
  const { node, parts } = found.value;
  if (parts.length === 0) return fail("EBUSY", path, "root");
  if (node.kind === "dir" && !options.recursive) return fail("EISDIR", path);

  const dirParts = parts.slice(0, -1);
  const dir = nodeAt(vfs.root, dirParts) as DirNode;
  if (!canModifyEntries(ctx.actor, dir)) return fail("EACCES", path);
  if (!stickyAllows(ctx.actor, dir, node)) return fail("EPERM", path, "sticky");
  if (node.kind === "dir") {
    const blocked = firstUnremovable(ctx.actor, node, path);
    if (blocked) return err(blocked);
  }
  return ok({
    root: setEntry(vfs.root, dirParts, parts[parts.length - 1] as string, undefined, ctx.now),
  });
}

/** Deleting a directory's contents needs read, write, and search permission on it, all the way down. */
function firstUnremovable(actor: FsActor, dir: DirNode, path: string): FsError | undefined {
  const names = childNames(dir);
  if (names.length === 0) return undefined;
  if (!canAccess(actor, dir, "r") || !canModifyEntries(actor, dir)) {
    return { code: "EACCES", path };
  }
  for (const name of names) {
    const child = childOf(dir, name) as VfsNode;
    const childPath = `${path.replace(/\/+$/, "")}/${name}`;
    if (!stickyAllows(actor, dir, child))
      return { code: "EPERM", path: childPath, detail: "sticky" };
    if (child.kind === "dir") {
      const blocked = firstUnremovable(actor, child, childPath);
      if (blocked) return blocked;
    }
  }
  return undefined;
}

/** Where a `mv` or `cp` lands: into `dst` if it's a directory, otherwise at `dst` itself. */
interface Destination {
  readonly dir: DirNode;
  readonly dirParts: readonly string[];
  readonly name: string;
  readonly existing: VfsNode | undefined;
}

function resolveDestination(
  vfs: Vfs,
  ctx: FsContext,
  dst: string,
  sourceName: string,
): FsResult<Destination> {
  const found = resolve(vfs, ctx, dst);
  if (found.ok && found.value.node.kind === "dir") {
    const dir = found.value.node;
    return ok({
      dir,
      dirParts: found.value.parts,
      name: sourceName,
      existing: childOf(dir, sourceName),
    });
  }
  if (!found.ok && found.error.code !== "ENOENT") return found;
  const parent = resolveParent(vfs, ctx.actor, ctx.cwd, dst);
  if (!parent.ok) return parent;
  const { dir, dirParts, name } = parent.value;
  return ok({ dir, dirParts, name, existing: childOf(dir, name) });
}

const isInside = (inner: readonly string[], outer: readonly string[]) =>
  inner.length >= outer.length && outer.every((part, i) => inner[i] === part);

/** Checks what replacing `existing` with a node of kind `incoming` would need. */
function replaceError(
  ctx: FsContext,
  target: Destination,
  incomingIsDir: boolean,
  path: string,
): FsError | undefined {
  const { existing } = target;
  if (!existing) return undefined;
  if (existing.kind === "dir") {
    if (!incomingIsDir) return { code: "EISDIR", path };
    if (childNames(existing).length > 0) return { code: "ENOTEMPTY", path };
  } else if (incomingIsDir) {
    return { code: "ENOTDIR", path };
  }
  if (!stickyAllows(ctx.actor, target.dir, existing))
    return { code: "EPERM", path, detail: "sticky" };
  return undefined;
}

/** Moves or renames. Moving keeps the node's owner, mode and mtime, like a real rename. */
export function mv(vfs: Vfs, ctx: FsContext, src: string, dst: string): FsResult<Vfs> {
  const last = splitPath(src).at(-1);
  if (last === "." || last === "..") return fail("EINVAL", src, "dot-path");
  const source = resolve(vfs, ctx, src, false);
  if (!source.ok) return source;
  const { node, parts } = source.value;
  if (parts.length === 0) return fail("EBUSY", src, "root");
  const srcDirParts = parts.slice(0, -1);
  const srcName = parts[parts.length - 1] as string;
  const srcDir = nodeAt(vfs.root, srcDirParts) as DirNode;
  if (!canModifyEntries(ctx.actor, srcDir)) return fail("EACCES", src);
  if (!stickyAllows(ctx.actor, srcDir, node)) return fail("EPERM", src, "sticky");

  const target = resolveDestination(vfs, ctx, dst, srcName);
  if (!target.ok) return target;
  const { dir, dirParts, name } = target.value;
  const targetParts = [...dirParts, name];
  if (targetParts.join("/") === parts.join("/")) return ok(vfs); // moving onto itself
  if (node.kind === "dir" && isInside(targetParts, parts))
    return fail("EINVAL", dst, "into-itself");
  if (!canModifyEntries(ctx.actor, dir)) return fail("EACCES", dst);
  if (!isValidName(name)) return fail("EINVAL", dst, "bad-name");
  const blocked = replaceError(ctx, target.value, node.kind === "dir", dst);
  if (blocked) return err(blocked);

  const removed = setEntry(vfs.root, srcDirParts, srcName, undefined, ctx.now);
  return ok({ root: setEntry(removed, dirParts, name, node, ctx.now) });
}

/**
 * Copies a file, or with `recursive` a directory. Copies belong to the person copying, get a fresh
 * mtime, and keep the source's mode minus the umask. Symlinks inside a copied directory are
 * copied as links.
 */
export function cp(
  vfs: Vfs,
  ctx: FsContext,
  src: string,
  dst: string,
  options: { readonly recursive?: boolean } = {},
): FsResult<Vfs> {
  const source = resolve(vfs, ctx, src);
  if (!source.ok) return source;
  const { node, parts } = source.value;
  if (node.kind === "dir" && !options.recursive) return fail("EISDIR", src, "omit-directory");

  const target = resolveDestination(vfs, ctx, dst, parts[parts.length - 1] ?? "root");
  if (!target.ok) return target;
  const { dir, dirParts, name, existing } = target.value;
  const targetParts = [...dirParts, name];
  if (node.kind === "dir" && isInside(targetParts, parts))
    return fail("EINVAL", dst, "into-itself");
  if (targetParts.join("/") === parts.join("/")) return fail("EINVAL", dst);

  // Overwriting an existing file keeps that file's owner and mode; only the content changes.
  if (existing && existing.kind === "file" && node.kind === "file") {
    if (!canAccess(ctx.actor, node, "r")) return fail("EACCES", src);
    if (!canAccess(ctx.actor, existing, "w")) return fail("EACCES", dst);
    const next: FileNode = { ...existing, content: node.content, mtime: ctx.now };
    return ok({ root: replaceNode(vfs.root, targetParts, next) });
  }
  if (!canModifyEntries(ctx.actor, dir)) return fail("EACCES", dst);
  if (!isValidName(name)) return fail("EINVAL", dst, "bad-name");
  const blocked = replaceError(ctx, target.value, node.kind === "dir", dst);
  if (blocked) return err(blocked);

  const copied = copyNode(ctx, node, dir, src);
  if (!copied.ok) return copied;
  return ok({ root: setEntry(vfs.root, dirParts, name, copied.value, ctx.now) });
}

function copyNode(ctx: FsContext, node: VfsNode, into: DirNode, path: string): FsResult<VfsNode> {
  const ownership = newOwnership(ctx.actor, into);
  const mode = node.mode & ~UMASK & 0o777;
  switch (node.kind) {
    case "symlink":
      return ok({ ...node, ...ownership, mtime: ctx.now });
    case "file":
      if (!canAccess(ctx.actor, node, "r")) return fail("EACCES", path);
      return ok({ ...node, ...ownership, mode, mtime: ctx.now });
    case "dir": {
      if (!canAccess(ctx.actor, node, "r") || !canAccess(ctx.actor, node, "x")) {
        return fail("EACCES", path);
      }
      const copy: DirNode = { kind: "dir", children: {}, ...ownership, mode, mtime: ctx.now };
      const children: [string, VfsNode][] = [];
      for (const name of childNames(node)) {
        const child = copyNode(ctx, childOf(node, name) as VfsNode, copy, `${path}/${name}`);
        if (!child.ok) return child;
        children.push([name, child.value]);
      }
      return ok({ ...copy, children: Object.fromEntries(children) });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------------------------

/** Changes permission bits. Only the owner or root may; follows symlinks. */
export function chmod(vfs: Vfs, ctx: FsContext, path: string, mode: number): FsResult<Vfs> {
  const found = resolve(vfs, ctx, path);
  if (!found.ok) return found;
  const { node, parts } = found.value;
  if (!isRoot(ctx.actor) && ctx.actor.user !== node.owner) return fail("EPERM", path);
  return ok({ root: replaceNode(vfs.root, parts, { ...node, mode: mode & MODE_MASK }) });
}

/**
 * Changes owner and/or group. Only root may give a file away; an owner may change its group to
 * one they belong to. Follows symlinks.
 */
export function chown(
  vfs: Vfs,
  ctx: FsContext,
  accounts: Accounts,
  path: string,
  change: { readonly owner?: string; readonly group?: string },
): FsResult<Vfs> {
  const { owner, group } = change;
  if (owner !== undefined && !hasUser(accounts, owner)) {
    return err({ code: "EINVAL", path, detail: "unknown-user", value: owner });
  }
  if (group !== undefined && !hasGroup(accounts, group)) {
    return err({ code: "EINVAL", path, detail: "unknown-group", value: group });
  }
  const found = resolve(vfs, ctx, path);
  if (!found.ok) return found;
  const { node, parts } = found.value;
  if (!isRoot(ctx.actor)) {
    const givesAway = owner !== undefined && owner !== node.owner;
    const regroups = group !== undefined && group !== node.group;
    const mayRegroup =
      ctx.actor.user === node.owner && group !== undefined && ctx.actor.groups.includes(group);
    if (givesAway || (regroups && !mayRegroup)) return fail("EPERM", path);
  }
  const next = { ...node, owner: owner ?? node.owner, group: group ?? node.group };
  return ok({ root: replaceNode(vfs.root, parts, next) });
}

/** New entries belong to the actor; a setgid directory passes its group down instead. */
function newOwnership(actor: FsActor, dir: DirNode): { owner: string; group: string } {
  return { owner: actor.user, group: dir.mode & SETGID ? dir.group : actor.group };
}
