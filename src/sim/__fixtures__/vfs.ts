/** A small filesystem for fs tests, built through the same declarative builder content uses. */
import { actorFor, buildAccounts } from "../fs/accounts";
import { buildFs } from "../fs/builder";
import type { FsContext } from "../fs/ops";
import type { FsActor, FsEntrySpec, UserSpec, Vfs } from "../fs/types";

export const T0 = Date.UTC(2026, 2, 2, 9, 0, 0);
export const T1 = T0 + 60_000;

const USERS: readonly UserSpec[] = [
  { name: "recruit", uid: 1000, groups: ["adm", "team"] },
  { name: "alex", uid: 1001, groups: ["team"] },
];

export const accounts = buildAccounts(USERS, [{ name: "adm" }, { name: "shadow" }]);

export const ENTRIES: readonly FsEntrySpec[] = [
  { path: "/home/recruit/notes.txt", content: "hello\n" },
  { path: "/home/recruit/docs/plan.txt", content: "step one\n" },
  { path: "/home/recruit/.hidden", content: "shh\n", mode: "600" },
  { path: "/home/recruit/to-log", target: "/var/log" },
  { path: "/home/recruit/dangling", target: "/nowhere" },
  { path: "/home/recruit/rel-link", target: "docs/plan.txt" },
  { path: "/home/alex/diary.txt", content: "private\n" },
  { path: "/var/log/auth.log", content: "entries\n", group: "adm", mode: "640" },
  { path: "/tmp/loop-a", target: "/tmp/loop-b" },
  { path: "/tmp/loop-b", target: "/tmp/loop-a" },
  { path: "/tmp/self", target: "self" },
  { path: "/tmp/alex.txt", content: "mine\n", owner: "alex", mode: "666" },
  { path: "/team", type: "dir", group: "team", mode: "2775" },
  { path: "/locked", type: "dir", mode: "700" },
  { path: "/locked/inside.txt", content: "x\n" },
  { path: "/shared-dir", type: "dir", mode: "777" },
  { path: "/shared-dir/root-owned", type: "dir", mode: "755" },
  { path: "/shared-dir/root-owned/file", content: "x\n" },
];

export const testVfs = (entries: readonly FsEntrySpec[] = ENTRIES): Vfs =>
  buildFs({ entries }, { accounts, users: USERS, hostname: "box", defaultMtime: T0 });

export const actor = (name: string): FsActor => {
  const found = actorFor(accounts, name);
  if (!found) throw new Error(`no test user ${name}`);
  return found;
};

export const as = (name: string, cwd = name === "root" ? "/root" : `/home/${name}`): FsContext => ({
  actor: actor(name),
  cwd,
  now: T1,
});
