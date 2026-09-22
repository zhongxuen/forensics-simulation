import { ProblemList } from "../core/scenario-error";
import { compareNames } from "./tree";
import type { Account, Accounts, FsActor, Group, GroupSpec, UserSpec } from "./types";

const NAME = /^[a-z_][a-z0-9_-]{0,31}$/;
const FIRST_AUTO_ID = 1000;

/**
 * Builds a machine's users and groups from a spec. Root (uid 0, group root) always exists. Groups
 * named as a user's primary or supplementary group are created if the spec doesn't list them.
 * Throws a ScenarioError listing every problem.
 */
export function buildAccounts(
  userSpecs: readonly UserSpec[] = [],
  groupSpecs: readonly GroupSpec[] = [],
  context = "accounts",
): Accounts {
  const problems = new ProblemList();
  const gids = new Map<string, number>([["root", 0]]);
  const usedGids = new Set<number>([0]);

  for (const { name, gid } of groupSpecs) {
    if (!NAME.test(name)) problems.add(`group name "${name}" should be lowercase letters/digits`);
    if (gids.has(name) && name !== "root") problems.add(`group "${name}" is listed twice`);
    if (name === "root") continue;
    if (gid !== undefined) {
      if (!Number.isInteger(gid) || gid < 1 || usedGids.has(gid)) {
        problems.add(`group "${name}" needs a unique gid above 0`);
      }
      usedGids.add(gid);
    }
    gids.set(name, gid ?? -1);
  }

  const allUsers: UserSpec[] = userSpecs.some((user) => user.name === "root")
    ? [...userSpecs]
    : [{ name: "root", uid: 0 }, ...userSpecs];
  const usedUids = new Set<number>();
  for (const user of allUsers) {
    if (!NAME.test(user.name)) problems.add(`user name "${user.name}" should be lowercase`);
    if (!Number.isInteger(user.uid) || user.uid < 0) {
      problems.add(`user "${user.name}" needs a whole-number uid`);
    }
    if (usedUids.has(user.uid)) problems.add(`uid ${user.uid} is used twice`);
    if ((user.uid === 0) !== (user.name === "root")) {
      problems.add(`only root may have uid 0 (user "${user.name}")`);
    }
    usedUids.add(user.uid);
  }
  if (new Set(allUsers.map((user) => user.name)).size !== allUsers.length) {
    problems.add("a user name is listed twice");
  }
  problems.throwIfAny(context);

  // Groups mentioned by users but not listed get created; a user's own group prefers gid = uid.
  const nextFreeGid = () => {
    let gid = FIRST_AUTO_ID;
    while (usedGids.has(gid)) gid++;
    return gid;
  };
  for (const user of allUsers) {
    const primary = user.group ?? user.name;
    if (!gids.has(primary)) {
      const gid = primary === user.name && !usedGids.has(user.uid) ? user.uid : nextFreeGid();
      gids.set(primary, gid);
      usedGids.add(gid);
    }
  }
  for (const user of allUsers) {
    for (const group of user.groups ?? []) {
      if (!NAME.test(group)) problems.add(`group name "${group}" should be lowercase`);
      if (!gids.has(group)) gids.set(group, -1);
    }
  }
  for (const [name, gid] of [...gids].sort(([a], [b]) => compareNames(a, b))) {
    if (gid === -1) {
      const assigned = nextFreeGid();
      gids.set(name, assigned);
      usedGids.add(assigned);
    }
  }
  problems.throwIfAny(context);

  const users: Record<string, Account> = {};
  for (const user of allUsers) {
    const group = user.group ?? user.name;
    users[user.name] = {
      name: user.name,
      uid: user.uid,
      gid: gids.get(group) as number,
      group,
      groups: [...new Set(user.groups ?? [])].filter((g) => g !== group).sort(compareNames),
      home: user.home ?? (user.name === "root" ? "/root" : `/home/${user.name}`),
      shell: user.shell ?? "/bin/bash",
    };
  }
  const groups: Record<string, Group> = {};
  for (const [name, gid] of gids) {
    groups[name] = {
      name,
      gid,
      members: Object.values(users)
        .filter((user) => user.groups.includes(name))
        .map((user) => user.name)
        .sort(compareNames),
    };
  }
  return { users, groups };
}

/** The permission-checking identity for a user, or `undefined` if there is no such user. */
export function actorFor(accounts: Accounts, userName: string): FsActor | undefined {
  const account = Object.hasOwn(accounts.users, userName) ? accounts.users[userName] : undefined;
  if (!account) return undefined;
  return {
    user: account.name,
    uid: account.uid,
    group: account.group,
    groups: [account.group, ...account.groups],
  };
}

export const hasUser = (accounts: Accounts, name: string): boolean =>
  Object.hasOwn(accounts.users, name);

export const hasGroup = (accounts: Accounts, name: string): boolean =>
  Object.hasOwn(accounts.groups, name);
