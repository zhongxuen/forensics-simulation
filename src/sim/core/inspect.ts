/**
 * Read-only questions about a state's filesystems, for code outside the engine that needs to know
 * what's true right now without running a command: mission objective checks (phase 06), for
 * example "is this file readable only by its owner?".
 *
 * Pure functions over a SimState. They never throw for anything a learner can cause: a missing
 * host, file, or user, or a symlink loop, is an answer ("doesn't exist", "can't access").
 */
import { actorFor } from "../fs/accounts";
import { joinPath } from "../fs/path";
import { canAccess } from "../fs/perms";
import { resolvePath } from "../fs/resolve";
import type { FsActor, NodeKind } from "../fs/types";
import type { SimState } from "./types";

/** Root sees everything, the way an inspector with full access would. */
const ROOT: FsActor = { user: "root", uid: 0, group: "root", groups: ["root"] };

export type PathInspection =
  | { readonly exists: false }
  | {
      readonly exists: true;
      /** Canonical absolute path: no ".", "..", or symlinks above the final component. */
      readonly path: string;
      readonly kind: NodeKind;
      /** Permission bits, including setuid, setgid and sticky: 0o644, 0o1777, ... */
      readonly mode: number;
      readonly owner: string;
      readonly group: string;
      /** Files only. */
      readonly content?: string;
      /** Symlinks only (when not followed): where the link points. */
      readonly target?: string;
    };

export interface InspectOptions {
  /** Follow a symlink in the final component, like `stat` (the default); false is like `lstat`. */
  readonly follow?: boolean;
}

const MISSING: PathInspection = { exists: false };

/** The machine for `hostId`, if that host has a filesystem. */
const machineOf = (state: SimState, hostId: string) =>
  Object.hasOwn(state.machines, hostId) ? state.machines[hostId] : undefined;

/**
 * What is at `path` on `hostId`'s filesystem, looked at as root. Relative paths start at "/".
 * A host without a filesystem, a missing path, and a symlink loop all report `exists: false`.
 */
export function inspectPath(
  state: SimState,
  hostId: string,
  path: string,
  options: InspectOptions = {},
): PathInspection {
  const machine = machineOf(state, hostId);
  if (!machine) return MISSING;
  const found = resolvePath(machine.fs, ROOT, "/", path, { follow: options.follow ?? true });
  if (!found.ok) return MISSING;
  const { node, parts } = found.value;
  return {
    exists: true,
    path: joinPath(parts),
    kind: node.kind,
    mode: node.mode,
    owner: node.owner,
    group: node.group,
    ...(node.kind === "file" && { content: node.content }),
    ...(node.kind === "symlink" && { target: node.target }),
  };
}

export type FileAccess = "r" | "w" | "x";

/**
 * Whether `user` on `hostId` could read, write, or execute `path`, by the engine's real permission
 * rules: search (x) permission on every folder on the way, symlinks followed, then the node's own
 * mode bits for that user. False for an unknown host, user, or path.
 */
export function userCanAccess(
  state: SimState,
  hostId: string,
  user: string,
  path: string,
  access: FileAccess,
): boolean {
  const machine = machineOf(state, hostId);
  if (!machine) return false;
  const actor = actorFor(machine.accounts, user);
  if (!actor) return false;
  const found = resolvePath(machine.fs, actor, "/", path);
  return found.ok && canAccess(actor, found.value.node, access);
}
