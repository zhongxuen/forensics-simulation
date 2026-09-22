/**
 * Shape checks for a SimState read back from JSON. A snapshot or bug report is untrusted input:
 * everything is checked before the engine touches it, and a bad blob becomes a readable error.
 */
import { actorFor } from "../fs/accounts";
import { isValidName } from "../fs/path";
import { resolvePath } from "../fs/resolve";
import type { Account, Accounts, Group, Vfs, VfsNode } from "../fs/types";
import type {
  DiscoveredHost,
  DiscoveredService,
  DiscoveryState,
  Host,
  NetworkGraph,
  Service,
} from "../net/types";
import type { Machine, SimState } from "./types";

/** Deeper than any real tree; stops a hostile snapshot from exhausting the stack. */
const MAX_TREE_DEPTH = 128;

const OS_FAMILIES = ["linux", "windows", "bsd", "macos", "embedded", "other"];

class ShapeError extends Error {}

type Obj = Record<string, unknown>;

function fail(path: string, expected: string): never {
  throw new ShapeError(`${path}: expected ${expected}`);
}

function obj(value: unknown, path: string): Obj {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "an object");
  return value as Obj;
}

function str(value: unknown, path: string): string {
  if (typeof value !== "string") fail(path, "a string");
  return value;
}

function int(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail(path, `a whole number from ${min} to ${max}`);
  }
  return value;
}

function num(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "a number");
  return value;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "true or false");
  return value;
}

function arr<T>(value: unknown, path: string, item: (v: unknown, p: string) => T): T[] {
  if (!Array.isArray(value)) fail(path, "a list");
  return value.map((entry, i) => item(entry, `${path}[${i}]`));
}

function record<T>(
  value: unknown,
  path: string,
  item: (v: unknown, p: string, key: string) => T,
): Record<string, T> {
  const source = obj(value, path);
  return Object.fromEntries(
    Object.keys(source).map((key) => [key, item(source[key], `${path}.${key}`, key)]),
  );
}

const optional = <T>(value: unknown, check: (v: unknown) => T): T | undefined =>
  value === undefined ? undefined : check(value);

function oneOf<T extends string>(value: unknown, path: string, options: readonly T[]): T {
  if (typeof value !== "string" || !options.includes(value as T)) fail(path, options.join(" or "));
  return value as T;
}

function node(value: unknown, path: string, depth: number): VfsNode {
  if (depth > MAX_TREE_DEPTH) fail(path, `a tree at most ${MAX_TREE_DEPTH} levels deep`);
  const o = obj(value, path);
  const meta = {
    owner: str(o.owner, `${path}.owner`),
    group: str(o.group, `${path}.group`),
    mode: int(o.mode, `${path}.mode`, 0, 0o7777),
    mtime: num(o.mtime, `${path}.mtime`),
  };
  switch (oneOf(o.kind, `${path}.kind`, ["file", "dir", "symlink"] as const)) {
    case "file":
      return { kind: "file", ...meta, content: str(o.content, `${path}.content`) };
    case "symlink":
      return { kind: "symlink", ...meta, target: str(o.target, `${path}.target`) };
    case "dir":
      return {
        kind: "dir",
        ...meta,
        children: record(o.children, `${path}.children`, (child, childPath, name) => {
          if (!isValidName(name)) fail(childPath, "a valid file name");
          return node(child, childPath, depth + 1);
        }),
      };
  }
}

function vfs(value: unknown, path: string): Vfs {
  const root = node(obj(value, path).root, `${path}.root`, 0);
  if (root.kind !== "dir") fail(`${path}.root`, "a directory");
  return { root };
}

function accounts(value: unknown, path: string): Accounts {
  const o = obj(value, path);
  const strings = (v: unknown, p: string) => arr(v, p, str);
  return {
    users: record(o.users, `${path}.users`, (u, p): Account => {
      const a = obj(u, p);
      return {
        name: str(a.name, `${p}.name`),
        uid: int(a.uid, `${p}.uid`),
        gid: int(a.gid, `${p}.gid`),
        group: str(a.group, `${p}.group`),
        groups: strings(a.groups, `${p}.groups`),
        home: str(a.home, `${p}.home`),
        shell: str(a.shell, `${p}.shell`),
      };
    }),
    groups: record(o.groups, `${path}.groups`, (g, p): Group => {
      const a = obj(g, p);
      return {
        name: str(a.name, `${p}.name`),
        gid: int(a.gid, `${p}.gid`),
        members: strings(a.members, `${p}.members`),
      };
    }),
  };
}

function service(value: unknown, path: string): Service {
  const o = obj(value, path);
  const headers = (v: unknown, p: string) => record(v, p, str);
  const http = optional(o.http, (h) => {
    const x = obj(h, `${path}.http`);
    return {
      ...(x.headers !== undefined && { headers: headers(x.headers, `${path}.http.headers`) }),
      pages: record(x.pages, `${path}.http.pages`, (page, p) => {
        const pg = obj(page, p);
        return {
          status: int(pg.status, `${p}.status`, 100, 599),
          ...(pg.title !== undefined && { title: str(pg.title, `${p}.title`) }),
          ...(pg.body !== undefined && { body: str(pg.body, `${p}.body`) }),
          ...(pg.headers !== undefined && { headers: headers(pg.headers, `${p}.headers`) }),
        };
      }),
    };
  });
  return {
    port: int(o.port, `${path}.port`, 1, 65535),
    protocol: oneOf(o.protocol, `${path}.protocol`, ["tcp", "udp"] as const),
    name: str(o.name, `${path}.name`),
    product: str(o.product, `${path}.product`),
    version: str(o.version, `${path}.version`),
    ...(o.banner !== undefined && { banner: str(o.banner, `${path}.banner`) }),
    ...(o.reachableFrom !== undefined && {
      reachableFrom: arr(o.reachableFrom, `${path}.reachableFrom`, str),
    }),
    ...(http !== undefined && { http }),
  };
}

function network(value: unknown, path: string): NetworkGraph {
  const o = obj(value, path);
  return {
    subnets: arr(o.subnets, `${path}.subnets`, (s, p) => {
      const x = obj(s, p);
      return {
        cidr: str(x.cidr, `${p}.cidr`),
        ...(x.name !== undefined && { name: str(x.name, `${p}.name`) }),
      };
    }),
    hosts: record(o.hosts, `${path}.hosts`, (h, p, key): Host => {
      const x = obj(h, p);
      if (x.id !== key) fail(`${p}.id`, `"${key}"`);
      const os = obj(x.os, `${p}.os`);
      return {
        id: key,
        hostname: str(x.hostname, `${p}.hostname`),
        interfaces: arr(x.interfaces, `${p}.interfaces`, (i, ip) => {
          const y = obj(i, ip);
          return { ip: str(y.ip, `${ip}.ip`), subnet: str(y.subnet, `${ip}.subnet`) };
        }),
        os: {
          family: oneOf(
            os.family,
            `${p}.os.family`,
            OS_FAMILIES as readonly Host["os"]["family"][],
          ),
          name: str(os.name, `${p}.os.name`),
          ...(os.version !== undefined && { version: str(os.version, `${p}.os.version`) }),
        },
        services: arr(x.services, `${p}.services`, service),
        reachableFrom: arr(x.reachableFrom, `${p}.reachableFrom`, str),
        respondsToPing: bool(x.respondsToPing, `${p}.respondsToPing`),
      };
    }),
  };
}

function discovery(value: unknown, path: string): DiscoveryState {
  return {
    hosts: record(obj(value, path).hosts, `${path}.hosts`, (h, p, key): DiscoveredHost => {
      const x = obj(h, p);
      if (x.hostId !== key) fail(`${p}.hostId`, `"${key}"`);
      return {
        hostId: key,
        ips: arr(x.ips, `${p}.ips`, str),
        ...(x.hostname !== undefined && { hostname: str(x.hostname, `${p}.hostname`) }),
        ...(x.osGuess !== undefined && { osGuess: str(x.osGuess, `${p}.osGuess`) }),
        firstSeenTick: int(x.firstSeenTick, `${p}.firstSeenTick`),
        via: str(x.via, `${p}.via`),
        // Optional so snapshots from before `answered` existed still load. They can't say, so
        // their hosts count as answered, like every host a tool records.
        answered: x.answered === undefined ? true : bool(x.answered, `${p}.answered`),
        portScanned: bool(x.portScanned, `${p}.portScanned`),
        accessed: bool(x.accessed, `${p}.accessed`),
        services: record(x.services, `${p}.services`, (s, sp): DiscoveredService => {
          const y = obj(s, sp);
          return {
            port: int(y.port, `${sp}.port`, 1, 65535),
            protocol: oneOf(y.protocol, `${sp}.protocol`, ["tcp", "udp"] as const),
            name: str(y.name, `${sp}.name`),
            ...(y.product !== undefined && { product: str(y.product, `${sp}.product`) }),
            ...(y.version !== undefined && { version: str(y.version, `${sp}.version`) }),
            ...(y.banner !== undefined && { banner: str(y.banner, `${sp}.banner`) }),
            firstSeenTick: int(y.firstSeenTick, `${sp}.firstSeenTick`),
            via: str(y.via, `${sp}.via`),
          };
        }),
      };
    }),
  };
}

/**
 * Checks and rebuilds a SimState from parsed JSON, keeping only known fields. Returns an error
 * message instead of throwing.
 */
export function validateState(
  value: unknown,
): { ok: true; state: SimState } | { ok: false; reason: string } {
  try {
    const o = obj(value, "state");
    const session = obj(o.session, "state.session");
    const state: SimState = {
      scenarioId: str(o.scenarioId, "state.scenarioId"),
      seed: int(o.seed, "state.seed", 0, 0xffffffff),
      tick: int(o.tick, "state.tick"),
      session: {
        hostId: str(session.hostId, "state.session.hostId"),
        user: str(session.user, "state.session.user"),
        cwd: str(session.cwd, "state.session.cwd"),
        env: record(session.env, "state.session.env", str),
        // Snapshots from before `history` existed have none.
        history: optional(session.history, (h) => arr(h, "state.session.history", str)) ?? [],
      },
      network: network(o.network, "state.network"),
      machines: record(o.machines, "state.machines", (m, p): Machine => {
        const x = obj(m, p);
        return { accounts: accounts(x.accounts, `${p}.accounts`), fs: vfs(x.fs, `${p}.fs`) };
      }),
      discovery: discovery(o.discovery, "state.discovery"),
      flags: arr(o.flags, "state.flags", (f, p) => {
        const x = obj(f, p);
        return { id: str(x.id, `${p}.id`), token: str(x.token, `${p}.token`) };
      }),
      flagsFound: arr(o.flagsFound, "state.flagsFound", str),
    };
    checkSession(state);
    return { ok: true, state };
  } catch (error) {
    if (error instanceof ShapeError) return { ok: false, reason: error.message };
    throw error;
  }
}

/** The session must point at a real host, machine, user, and folder. */
function checkSession(state: SimState): void {
  const { hostId, user, cwd } = state.session;
  if (!Object.hasOwn(state.network.hosts, hostId))
    fail("state.session.hostId", "a host in state.network.hosts");
  const machine = Object.hasOwn(state.machines, hostId) ? state.machines[hostId] : undefined;
  if (!machine) fail("state.session.hostId", "a host in state.machines");
  const actor = actorFor(machine.accounts, user);
  if (!actor) fail("state.session.user", `a user on "${hostId}"`);
  const found = resolvePath(machine.fs, actor, "/", cwd);
  if (
    !cwd.startsWith("/") ||
    !found.ok ||
    found.value.node.kind !== "dir" ||
    `/${found.value.parts.join("/")}` !== cwd
  ) {
    fail("state.session.cwd", "a canonical path to a folder the user can enter");
  }
}
