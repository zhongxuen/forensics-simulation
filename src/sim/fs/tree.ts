/**
 * Structural-sharing helpers for the immutable tree. An update rebuilds only the directories on
 * the path to the change; every other branch is the same object as before.
 */
import type { DirNode, VfsNode } from "./types";

/** A directory's child by name. Uses an own-property check so "constructor" or "__proto__" is safe. */
export function childOf(dir: DirNode, name: string): VfsNode | undefined {
  return Object.hasOwn(dir.children, name) ? dir.children[name] : undefined;
}

/** Child names in a stable order (UTF-16 code unit order, like `LC_ALL=C ls`). */
export function childNames(dir: DirNode): string[] {
  return Object.keys(dir.children).sort(compareNames);
}

export const compareNames = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The node at a canonical path, with no permission checks and no symlink following. */
export function nodeAt(root: DirNode, parts: readonly string[]): VfsNode | undefined {
  let node: VfsNode = root;
  for (const part of parts) {
    if (node.kind !== "dir") return undefined;
    const child = childOf(node, part);
    if (!child) return undefined;
    node = child;
  }
  return node;
}

/** Returns a copy of `children` with `name` set to `node`, or removed when `node` is undefined. */
function withEntry(
  children: Readonly<Record<string, VfsNode>>,
  name: string,
  node: VfsNode | undefined,
): Readonly<Record<string, VfsNode>> {
  // Object.fromEntries defines own properties, so even "__proto__" is stored as a plain name.
  const entries = Object.entries(children).filter(([key]) => key !== name);
  if (node) entries.push([name, node]);
  return Object.fromEntries(entries);
}

/**
 * Applies `update` to the directory at canonical path `parts` and returns the new root.
 * Callers must have resolved `parts` already; a path that isn't a directory is a bug, so it throws.
 */
export function updateDir(
  root: DirNode,
  parts: readonly string[],
  update: (dir: DirNode) => DirNode,
): DirNode {
  const walk = (dir: DirNode, index: number): DirNode => {
    if (index === parts.length) return update(dir);
    const name = parts[index] as string;
    const child = childOf(dir, name);
    if (!child || child.kind !== "dir") {
      throw new Error(`vfs invariant: /${parts.slice(0, index + 1).join("/")} is not a directory`);
    }
    return { ...dir, children: withEntry(dir.children, name, walk(child, index + 1)) };
  };
  return walk(root, 0);
}

/**
 * Adds, replaces (`node`), or removes (`undefined`) the entry `name` in the directory at `dirParts`.
 * The directory's mtime becomes `mtime`, like a real directory whose entries changed.
 */
export function setEntry(
  root: DirNode,
  dirParts: readonly string[],
  name: string,
  node: VfsNode | undefined,
  mtime: number,
): DirNode {
  return updateDir(root, dirParts, (dir) => ({
    ...dir,
    mtime,
    children: withEntry(dir.children, name, node),
  }));
}

/** Replaces the node at canonical path `parts` in place (metadata or content change). */
export function replaceNode(root: DirNode, parts: readonly string[], node: VfsNode): DirNode {
  if (parts.length === 0) {
    if (node.kind !== "dir") throw new Error("vfs invariant: the root must stay a directory");
    return node;
  }
  const name = parts[parts.length - 1] as string;
  return updateDir(root, parts.slice(0, -1), (dir) => ({
    ...dir,
    children: withEntry(dir.children, name, node),
  }));
}

/** UTF-8 byte length, for file sizes. */
export function byteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      bytes += 4; // a surrogate pair is one 4-byte character
      i++;
    } else bytes += 3;
  }
  return bytes;
}
