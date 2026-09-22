/** Builds a scenario's starting SimState from its declarative spec. */
import { actorFor, buildAccounts } from "../fs/accounts";
import { buildFs } from "../fs/builder";
import { joinPath, normalizePath } from "../fs/path";
import { resolvePath } from "../fs/resolve";
import type { Account } from "../fs/types";
import { buildNetwork } from "../net/build";
import { emptyDiscovery, markAccessed, recordHost } from "../net/discovery";
import { hostById, primaryIp } from "../net/graph";
import type { DiscoveryState, Host, HostSpec, NetworkGraph } from "../net/types";
import { parseInstant } from "./clock";
import { freezeInDev } from "./freeze";
import { normalizeSeed } from "./rng";
import { ProblemList, ScenarioError } from "./scenario-error";
import type { Machine, ScenarioSpec, SimState } from "./types";

/** When scenarios start unless they say otherwise: in-world time, not the real clock. */
export const DEFAULT_START_TIME = "2026-03-02T09:00:00Z";

/** The groups every "linux" machine has, for /etc/shadow and readable logs. */
const LINUX_GROUPS = ["adm", "shadow"];

export function scenarioStartMs(spec: ScenarioSpec): number {
  const ms = parseInstant(spec.startTime ?? DEFAULT_START_TIME);
  if (ms === undefined) {
    throw new ScenarioError(`scenario "${spec.id}" is not valid`, [
      `startTime "${spec.startTime}" should be ISO-8601, like "${DEFAULT_START_TIME}"`,
    ]);
  }
  return ms;
}

/**
 * The starting state for a scenario. Throws a ScenarioError if the spec is malformed: that's an
 * authoring bug, caught by content tests, never something a learner can trigger.
 */
export function createInitialState(spec: ScenarioSpec, seed: number): SimState {
  const problems = new ProblemList();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(spec.id)) {
    problems.add(`id "${spec.id}" should be lowercase letters, digits and "-"`);
  }
  const startMs = scenarioStartMs(spec);
  const network = buildNetwork(spec.network);

  const machines: Record<string, Machine> = {};
  for (const host of spec.network.hosts) {
    if (host.fs || host.users) machines[host.id] = buildMachine(host, startMs);
  }

  for (const id of spec.knownHosts ?? []) {
    if (!hostById(network, id)) problems.add(`knownHosts: "${id}" is not a host`);
  }
  const flagIds = new Set<string>();
  for (const flag of spec.flags ?? []) {
    if (flagIds.has(flag.id)) problems.add(`flag "${flag.id}" is listed twice`);
    if (flag.token.trim().length < 4)
      problems.add(`flag "${flag.id}" needs a token of at least 4 characters`);
    flagIds.add(flag.id);
  }
  const start = sessionStart(spec, network, machines, problems);
  problems.throwIfAny(`scenario "${spec.id}" is not valid`);
  if (!start) throw new Error("unreachable: sessionStart reports its problems");
  const { host, account, cwd } = start;

  return freezeInDev({
    scenarioId: spec.id,
    seed: normalizeSeed(seed),
    tick: 0,
    session: {
      hostId: host.id,
      user: account.name,
      cwd,
      env: {
        HOME: account.home,
        HOSTNAME: host.hostname,
        PATH: "/usr/local/bin:/usr/bin:/bin",
        SHELL: account.shell,
        USER: account.name,
        ...spec.session.env,
        PWD: cwd,
      },
      history: [],
    },
    network,
    machines,
    discovery: initialDiscovery(network, host, spec.knownHosts ?? []),
    flags: (spec.flags ?? []).map(({ id, token }) => ({ id, token })),
    flagsFound: [],
  });
}

/** Checks where the learner starts: a host with a filesystem, a real user, an enterable folder. */
function sessionStart(
  spec: ScenarioSpec,
  network: NetworkGraph,
  machines: Readonly<Record<string, Machine>>,
  problems: ProblemList,
): { host: Host; account: Account; cwd: string } | undefined {
  const { session } = spec;
  const problem = (text: string) => {
    problems.add(text);
    return undefined;
  };
  const host = hostById(network, session.host);
  const machine = Object.hasOwn(machines, session.host) ? machines[session.host] : undefined;
  if (!host) return problem(`session host "${session.host}" is not a host`);
  if (!machine) return problem(`session host "${session.host}" needs a filesystem (fs)`);
  const account = Object.hasOwn(machine.accounts.users, session.user)
    ? machine.accounts.users[session.user]
    : undefined;
  const actor = actorFor(machine.accounts, session.user);
  if (!account || !actor)
    return problem(`session user "${session.user}" is not a user on "${session.host}"`);

  // Start in the requested folder, else the user's home, else "/" if the home doesn't exist.
  const found = resolvePath(machine.fs, actor, "/", normalizePath(session.cwd ?? account.home));
  if (found.ok && found.value.node.kind === "dir") {
    return { host, account, cwd: joinPath(found.value.parts) };
  }
  if (session.cwd !== undefined) {
    return problem(`session cwd "${session.cwd}" is not a folder the user can enter`);
  }
  return { host, account, cwd: "/" };
}

/**
 * The learner starts knowing their own machine, plus any hosts the briefing mentions. Briefing
 * hosts haven't answered anything yet, so the map shows them as "unknown" until a tool hears back.
 */
function initialDiscovery(
  network: NetworkGraph,
  sessionHost: Host,
  knownHosts: readonly string[],
): DiscoveryState {
  let discovery = recordHost(emptyDiscovery(), {
    hostId: sessionHost.id,
    ip: primaryIp(sessionHost),
    hostname: sessionHost.hostname,
    via: "session",
    tick: 0,
  }).discovery;
  discovery = markAccessed(discovery, sessionHost.id);
  for (const id of knownHosts) {
    const host = hostById(network, id);
    if (!host) continue;
    discovery = recordHost(discovery, {
      hostId: id,
      ip: primaryIp(host),
      hostname: host.hostname,
      via: "briefing",
      tick: 0,
      answered: false,
    }).discovery;
  }
  return discovery;
}

function buildMachine(host: HostSpec, startMs: number): Machine {
  const base = host.fs?.base ?? "linux";
  const listed = new Set((host.groups ?? []).map((group) => group.name));
  const groups = [
    ...(host.groups ?? []),
    ...(base === "linux"
      ? LINUX_GROUPS.filter((name) => !listed.has(name)).map((name) => ({ name }))
      : []),
  ];
  const accounts = buildAccounts(host.users, groups, `host "${host.id}" accounts are not valid`);
  const fs = buildFs(host.fs ?? {}, {
    accounts,
    users: host.users ?? [],
    hostname: host.hostname,
    defaultMtime: startMs,
    context: `host "${host.id}" filesystem`,
  });
  return { accounts, fs };
}
