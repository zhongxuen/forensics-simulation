/**
 * The virtual filesystem: an immutable tree of plain objects. Every write returns a new tree that
 * shares every untouched branch with the old one (structural sharing), so writes are cheap and old
 * states stay valid.
 */

export interface NodeMeta {
  /** Owner's user name. Names, not numeric ids, keep snapshots readable. */
  readonly owner: string;
  readonly group: string;
  /** Permission bits, including setuid/setgid/sticky: 0o644, 0o1777, ... */
  readonly mode: number;
  /** Last modification time, in ms since the Unix epoch. */
  readonly mtime: number;
}

export interface FileNode extends NodeMeta {
  readonly kind: "file";
  readonly content: string;
}

export interface DirNode extends NodeMeta {
  readonly kind: "dir";
  /** Look children up with `childOf` (fs/tree.ts), never by indexing: names like "constructor" are legal. */
  readonly children: Readonly<Record<string, VfsNode>>;
}

export interface SymlinkNode extends NodeMeta {
  readonly kind: "symlink";
  readonly target: string;
}

export type VfsNode = FileNode | DirNode | SymlinkNode;
export type NodeKind = VfsNode["kind"];

export interface Vfs {
  readonly root: DirNode;
}

/** One machine's filesystem, as stored in a snapshot. */
export type VfsSnapshot = Vfs;

/** Who is asking. Permission checks run against this, like a real kernel checks a process's user. */
export interface FsActor {
  readonly user: string;
  readonly uid: number;
  /** Primary group: new files get this group. */
  readonly group: string;
  /** Every group the user belongs to, primary group first. */
  readonly groups: readonly string[];
}

/** What `stat` reports about one node. */
export interface StatInfo {
  /** Canonical absolute path (no ".", "..", or symlinks in the directories above it). */
  readonly path: string;
  readonly name: string;
  readonly kind: NodeKind;
  readonly owner: string;
  readonly group: string;
  readonly mode: number;
  readonly mtime: number;
  /** Bytes of content for files, 4096 for directories, target length for symlinks. */
  readonly size: number;
  /** Symlinks only: where the link points. */
  readonly target?: string;
}

export interface Account {
  readonly name: string;
  readonly uid: number;
  readonly gid: number;
  /** Primary group name. */
  readonly group: string;
  /** Supplementary group names, sorted. */
  readonly groups: readonly string[];
  readonly home: string;
  readonly shell: string;
}

export interface Group {
  readonly name: string;
  readonly gid: number;
  /** Users with this as a supplementary group, sorted. */
  readonly members: readonly string[];
}

/** A machine's users and groups: the simulated /etc/passwd and /etc/group. */
export interface Accounts {
  readonly users: Readonly<Record<string, Account>>;
  readonly groups: Readonly<Record<string, Group>>;
}

// ---------------------------------------------------------------------------------------------
// Declarative specs, written in mission content and turned into a Vfs by fs/builder.ts
// ---------------------------------------------------------------------------------------------

export interface UserSpec {
  readonly name: string;
  readonly uid: number;
  /** Primary group. Defaults to a group with the user's own name, created if needed. */
  readonly group?: string;
  /** Supplementary groups, created if needed. */
  readonly groups?: readonly string[];
  /** Defaults to /root for root and /home/<name> for everyone else. */
  readonly home?: string;
  readonly shell?: string;
  /**
   * A made-up hash-shaped string for the generated /etc/shadow (base "linux" only). Never a real
   * password's hash. Omitted means the account is locked ("!").
   */
  readonly passwordHash?: string;
}

export interface GroupSpec {
  readonly name: string;
  readonly gid?: number;
}

/**
 * One file, directory, or symlink. The kind comes from `type`, or else from the fields: `target`
 * makes a symlink, `content` makes a file. Directories need `type: "dir"`.
 */
export interface FsEntrySpec {
  /** Absolute path, like "/home/recruit/notes.txt". Missing parent directories are created. */
  readonly path: string;
  readonly type?: NodeKind;
  readonly content?: string;
  readonly target?: string;
  /**
   * Defaults to the user whose home the entry is in (anything under /home/<name>), else root.
   */
  readonly owner?: string;
  /** Defaults to the owner's primary group. */
  readonly group?: string;
  /** Octal digits as a string, like "644" or "1777". Defaults: files 644, dirs 755, links 777. */
  readonly mode?: string;
  /** ISO-8601 time, like "2026-03-01T22:14:00Z". Defaults to the scenario's start time. */
  readonly mtime?: string;
}

export interface FsSpec {
  /**
   * "linux" (the default) starts from a small standard layout: /bin, /etc, /home, /root, /tmp,
   * /usr, /var/log, a home folder per user, and /etc/passwd, /etc/group, /etc/shadow and
   * /etc/hostname generated from the machine's accounts. "empty" starts from an empty root.
   */
  readonly base?: "linux" | "empty";
  /** Applied in order after the base; an entry can override a base entry at the same path. */
  readonly entries?: readonly FsEntrySpec[];
}
