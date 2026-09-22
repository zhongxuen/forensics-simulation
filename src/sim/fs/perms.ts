import { STICKY } from "./mode";
import type { DirNode, FsActor, VfsNode } from "./types";

export type Access = "r" | "w" | "x";

const BIT: Record<Access, number> = { r: 4, w: 2, x: 1 };

export const isRoot = (actor: FsActor): boolean => actor.uid === 0;

/**
 * POSIX permission check. The owner's bits apply to the owner, the group's bits to members of the
 * node's group, and the "other" bits to everyone else; only the first matching class counts. Root
 * skips read/write checks, and may execute a file only if some execute bit is set.
 */
export function canAccess(actor: FsActor, node: VfsNode, access: Access): boolean {
  if (isRoot(actor)) {
    return access !== "x" || node.kind === "dir" || (node.mode & 0o111) !== 0;
  }
  const bits =
    actor.user === node.owner
      ? (node.mode >> 6) & 7
      : actor.groups.includes(node.group)
        ? (node.mode >> 3) & 7
        : node.mode & 7;
  return (bits & BIT[access]) !== 0;
}

/**
 * In a sticky directory (like /tmp), only root, the entry's owner, or the directory's owner may
 * delete or rename an entry, even though everyone can write to the directory.
 */
export function stickyAllows(actor: FsActor, dir: DirNode, entry: VfsNode): boolean {
  return (
    (dir.mode & STICKY) === 0 ||
    isRoot(actor) ||
    actor.user === entry.owner ||
    actor.user === dir.owner
  );
}

/** Whether `actor` may add or remove entries in `dir`: write plus search permission. */
export const canModifyEntries = (actor: FsActor, dir: DirNode): boolean =>
  canAccess(actor, dir, "w") && canAccess(actor, dir, "x");
