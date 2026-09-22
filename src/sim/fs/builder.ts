/**
 * Builds a filesystem from a declarative spec, so mission content describes files as data:
 *
 *   fs: {
 *     entries: [
 *       { path: "/home/recruit/notes.txt", content: "Remember to lock the door." },
 *       { path: "/etc/shadow", content: "...", mode: "640", group: "shadow" },
 *       { path: "/home/recruit/logs", target: "/var/log" },
 *     ],
 *   }
 *
 * Throws a ScenarioError listing every problem in the spec.
 */
import { parseInstant } from "../core/clock";
import { ProblemList } from "../core/scenario-error";
import { hasGroup, hasUser } from "./accounts";
import { DEFAULT_DIR_MODE, DEFAULT_FILE_MODE, SYMLINK_MODE, parseOctalMode, STICKY } from "./mode";
import { isValidName, splitPath } from "./path";
import { compareNames } from "./tree";
import type {
  Accounts,
  DirNode,
  FsEntrySpec,
  FsSpec,
  NodeKind,
  NodeMeta,
  UserSpec,
  Vfs,
  VfsNode,
} from "./types";

export interface BuildFsOptions {
  readonly accounts: Accounts;
  /** The user specs the accounts came from; their `passwordHash`es fill /etc/shadow. */
  readonly users?: readonly UserSpec[];
  /** Written to /etc/hostname by the "linux" base. */
  readonly hostname: string;
  /** mtime for anything the spec doesn't date, in ms since the epoch. */
  readonly defaultMtime: number;
  /** Names the machine in error messages. */
  readonly context?: string;
}

type Draft =
  | { kind: "dir"; meta: NodeMeta; children: Map<string, Draft> }
  | { kind: "file"; meta: NodeMeta; content: string }
  | { kind: "symlink"; meta: NodeMeta; target: string };

const DAY_MS = 86_400_000;

export function buildFs(spec: FsSpec, options: BuildFsOptions): Vfs {
  const problems = new ProblemList();
  const { accounts, defaultMtime } = options;
  const root: Draft = {
    kind: "dir",
    meta: { owner: "root", group: "root", mode: DEFAULT_DIR_MODE, mtime: defaultMtime },
    children: new Map(),
  };
  const specPaths = new Set<string>();

  const homeOwner = (parts: readonly string[]): string => {
    const [top, user] = parts;
    return top === "home" && user !== undefined && hasUser(accounts, user) ? user : "root";
  };
  const primaryGroup = (user: string): string => accounts.users[user]?.group ?? "root";

  const apply = (entry: FsEntrySpec, fromSpec: boolean) => {
    const where = `"${entry.path}"`;
    const problemsBefore = problems.size;
    if (!entry.path.startsWith("/")) return problems.add(`${where} must be an absolute path`);
    const parts = splitPath(entry.path);
    if (parts.length === 0) return problems.add(`${where}: the root directory can't be redefined`);
    if (parts.some((part) => !isValidName(part))) {
      return problems.add(`${where} contains an empty, ".", or ".." part`);
    }
    const canonical = `/${parts.join("/")}`;
    if (fromSpec) {
      if (specPaths.has(canonical)) problems.add(`${where} is listed twice`);
      specPaths.add(canonical);
    }

    const kind = kindOf(entry);
    if (!kind) {
      return problems.add(`${where}: add content (a file), target (a symlink), or type: "dir"`);
    }
    if (kind === "symlink" && !entry.target) problems.add(`${where}: a symlink needs a target`);
    if (kind !== "file" && entry.content !== undefined)
      problems.add(`${where}: only files have content`);
    const owner = entry.owner ?? homeOwner(parts);
    const group = entry.group ?? primaryGroup(owner);
    if (!hasUser(accounts, owner)) problems.add(`${where}: owner "${owner}" is not a user`);
    if (!hasGroup(accounts, group)) problems.add(`${where}: group "${group}" is not a group`);
    const mode =
      entry.mode === undefined
        ? kind === "dir"
          ? DEFAULT_DIR_MODE
          : kind === "file"
            ? DEFAULT_FILE_MODE
            : SYMLINK_MODE
        : parseOctalMode(entry.mode);
    if (mode === undefined)
      problems.add(`${where}: mode "${entry.mode}" should be octal, like "644"`);
    const mtime = entry.mtime === undefined ? defaultMtime : parseInstant(entry.mtime);
    if (mtime === undefined)
      problems.add(`${where}: mtime should be ISO-8601, like "2026-03-01T22:14:00Z"`);
    if (problems.size > problemsBefore) return;
    const meta: NodeMeta = { owner, group, mode: mode as number, mtime: mtime as number };

    // Walk down, creating missing parent directories as we go.
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i] as string;
      let next = dir.children.get(name);
      if (!next) {
        const parentOwner = homeOwner(parts.slice(0, i + 1));
        next = {
          kind: "dir",
          meta: {
            owner: parentOwner,
            group: primaryGroup(parentOwner),
            mode: DEFAULT_DIR_MODE,
            mtime: defaultMtime,
          },
          children: new Map(),
        };
        dir.children.set(name, next);
      }
      if (next.kind !== "dir")
        return problems.add(`${where}: /${parts.slice(0, i + 1).join("/")} is not a directory`);
      dir = next;
    }

    const name = parts[parts.length - 1] as string;
    const existing = dir.children.get(name);
    if (kind === "dir") {
      // Redefining a directory changes its metadata and keeps what's inside.
      dir.children.set(name, {
        kind: "dir",
        meta,
        children: existing?.kind === "dir" ? existing.children : new Map(),
      });
    } else if (kind === "file") {
      dir.children.set(name, { kind: "file", meta, content: entry.content ?? "" });
    } else {
      dir.children.set(name, { kind: "symlink", meta, target: entry.target ?? "" });
    }
  };

  if ((spec.base ?? "linux") === "linux") {
    for (const entry of linuxBase(options)) apply(entry, false);
  }
  for (const entry of spec.entries ?? []) apply(entry, true);
  problems.throwIfAny(`${options.context ?? "filesystem"} is not valid`);

  return { root: freezeDraft(root) as DirNode };
}

function kindOf(entry: FsEntrySpec): NodeKind | undefined {
  if (entry.type) return entry.type;
  if (entry.target !== undefined) return "symlink";
  if (entry.content !== undefined) return "file";
  return undefined;
}

function freezeDraft(draft: Draft): VfsNode {
  switch (draft.kind) {
    case "file":
      return { kind: "file", ...draft.meta, content: draft.content };
    case "symlink":
      return { kind: "symlink", ...draft.meta, target: draft.target };
    case "dir": {
      const names = [...draft.children.keys()].sort(compareNames);
      const children = Object.fromEntries(
        names.map((name) => [name, freezeDraft(draft.children.get(name) as Draft)]),
      );
      return { kind: "dir", ...draft.meta, children };
    }
  }
}

/** The standard layout every "linux" machine starts from. */
function linuxBase({
  accounts,
  users = [],
  hostname,
  defaultMtime,
}: BuildFsOptions): FsEntrySpec[] {
  const dir = (path: string, mode = "755"): FsEntrySpec => ({
    path,
    type: "dir",
    mode,
    owner: "root",
  });
  const accountList = Object.values(accounts.users).sort((a, b) => a.uid - b.uid);
  const groupList = Object.values(accounts.groups).sort((a, b) => a.gid - b.gid);
  const hashes = new Map(users.map((user) => [user.name, user.passwordHash]));
  const days = Math.floor(defaultMtime / DAY_MS);
  const hasShadowGroup = hasGroup(accounts, "shadow");

  return [
    ...["/bin", "/etc", "/home", "/usr", "/usr/bin", "/var", "/var/log"].map((path) => dir(path)),
    dir("/root", "700"),
    { path: "/tmp", type: "dir", owner: "root", mode: (0o777 | STICKY).toString(8) },
    ...accountList
      .filter((account) => account.home.startsWith("/home/"))
      .map((account): FsEntrySpec => ({
        path: account.home,
        type: "dir",
        owner: account.name,
        group: account.group,
        mode: "750",
      })),
    { path: "/etc/hostname", content: `${hostname}\n`, owner: "root" },
    {
      path: "/etc/passwd",
      owner: "root",
      content: lines(
        accountList.map((a) => `${a.name}:x:${a.uid}:${a.gid}:${a.name}:${a.home}:${a.shell}`),
      ),
    },
    {
      path: "/etc/group",
      owner: "root",
      content: lines(groupList.map((g) => `${g.name}:x:${g.gid}:${g.members.join(",")}`)),
    },
    {
      path: "/etc/shadow",
      owner: "root",
      group: hasShadowGroup ? "shadow" : "root",
      mode: hasShadowGroup ? "640" : "600",
      content: lines(
        accountList.map(
          (a) =>
            `${a.name}:${hashes.get(a.name) ?? (a.uid === 0 ? "*" : "!")}:${days}:0:99999:7:::`,
        ),
      ),
    },
  ];
}

const lines = (items: readonly string[]) => items.map((line) => `${line}\n`).join("");
