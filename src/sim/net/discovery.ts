/**
 * Discovery state: what the learner has observed, kept apart from ground truth. Tools record what
 * their output revealed; nothing here ever copies a fact the learner hasn't seen. Every function
 * is pure and returns a new state plus whether anything was new (new facts become events).
 *
 * `selectTopology` turns discovery state into the network map's nodes, subnets and links.
 */
import type { SimState } from "../core/types";
import { hostById } from "./graph";
import { cidrContains, compareIps, formatCidr, maskFor, parseCidr, parseIpv4 } from "./ip";
import type {
  DiscoveredHost,
  DiscoveredService,
  DiscoveredTopology,
  DiscoveryState,
  NetworkGraph,
  Protocol,
  TopologyLink,
  TopologyNode,
  TopologyNodeState,
  TopologySubnet,
} from "./types";

export const emptyDiscovery = (): DiscoveryState => ({ hosts: {} });

export const serviceKey = (port: number, protocol: Protocol): string => `${port}/${protocol}`;

export function discoveredHost(state: DiscoveryState, hostId: string): DiscoveredHost | undefined {
  return Object.hasOwn(state.hosts, hostId) ? state.hosts[hostId] : undefined;
}

export const isDiscovered = (state: DiscoveryState, hostId: string): boolean =>
  discoveredHost(state, hostId) !== undefined;

export interface Recorded {
  readonly discovery: DiscoveryState;
  readonly isNew: boolean;
}

const withHost = (state: DiscoveryState, host: DiscoveredHost): DiscoveryState => ({
  hosts: { ...state.hosts, [host.hostId]: host },
});

/**
 * Records that a host answered at `ip`. New the first time this host is seen at all.
 *
 * `answered` defaults to true, because tools only record hosts that replied. The briefing passes
 * false: the learner knows the host's name and address, but hasn't seen it answer. A later answer
 * flips it to true; nothing ever flips it back.
 */
export function recordHost(
  state: DiscoveryState,
  seen: {
    readonly hostId: string;
    readonly ip: string;
    readonly hostname?: string;
    readonly via: string;
    readonly tick: number;
    readonly answered?: boolean;
  },
): Recorded {
  const existing = discoveredHost(state, seen.hostId);
  if (!existing) {
    const host: DiscoveredHost = {
      hostId: seen.hostId,
      ips: [seen.ip],
      ...(seen.hostname !== undefined && { hostname: seen.hostname }),
      firstSeenTick: seen.tick,
      via: seen.via,
      answered: seen.answered ?? true,
      portScanned: false,
      accessed: false,
      services: {},
    };
    return { discovery: withHost(state, host), isNew: true };
  }
  const ips = existing.ips.includes(seen.ip)
    ? existing.ips
    : [...existing.ips, seen.ip].sort(compareIps);
  const hostname = existing.hostname ?? seen.hostname;
  const answered = existing.answered || (seen.answered ?? true);
  if (ips === existing.ips && hostname === existing.hostname && answered === existing.answered)
    return { discovery: state, isNew: false };
  const host = { ...existing, ips, ...(hostname !== undefined && { hostname }), answered };
  return { discovery: withHost(state, host), isNew: false };
}

/**
 * Records a service on an already-discovered host. New the first time that port is seen; later
 * observations fill in details (product, version, banner) without replacing known ones.
 */
export function recordService(
  state: DiscoveryState,
  hostId: string,
  seen: Omit<DiscoveredService, "firstSeenTick" | "via"> & {
    readonly via: string;
    readonly tick: number;
  },
): Recorded {
  const host = discoveredHost(state, hostId);
  if (!host) throw new Error(`discovery invariant: record host "${hostId}" before its services`);
  const key = serviceKey(seen.port, seen.protocol);
  const existing = Object.hasOwn(host.services, key) ? host.services[key] : undefined;
  const merged: DiscoveredService = {
    port: seen.port,
    protocol: seen.protocol,
    name: existing?.name ?? seen.name,
    ...pick("product", existing?.product ?? seen.product),
    ...pick("version", existing?.version ?? seen.version),
    ...pick("banner", existing?.banner ?? seen.banner),
    firstSeenTick: existing?.firstSeenTick ?? seen.tick,
    via: existing?.via ?? seen.via,
  };
  if (existing && sameService(existing, merged)) return { discovery: state, isNew: false };
  const next = { ...host, services: { ...host.services, [key]: merged } };
  return { discovery: withHost(state, next), isNew: !existing };
}

/** Marks a host as port-scanned, with an OS guess if the scan produced one. */
export function markPortScanned(
  state: DiscoveryState,
  hostId: string,
  osGuess?: string,
): DiscoveryState {
  const host = discoveredHost(state, hostId);
  if (!host) throw new Error(`discovery invariant: host "${hostId}" was never discovered`);
  if (host.portScanned && (osGuess === undefined || host.osGuess === osGuess)) return state;
  return withHost(state, { ...host, portScanned: true, ...(osGuess !== undefined && { osGuess }) });
}

/** Marks a host as one the learner has a session on. */
export function markAccessed(state: DiscoveryState, hostId: string): DiscoveryState {
  const host = discoveredHost(state, hostId);
  if (!host) throw new Error(`discovery invariant: host "${hostId}" was never discovered`);
  return host.accessed ? state : withHost(state, { ...host, accessed: true });
}

const pick = <K extends string>(key: K, value: string | undefined) =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<K, string>>;

const sameService = (a: DiscoveredService, b: DiscoveredService) =>
  a.name === b.name && a.product === b.product && a.version === b.version && a.banner === b.banner;

// ---------------------------------------------------------------------------------------------
// The network map's view: what the learner has discovered, as nodes, subnets and links
// ---------------------------------------------------------------------------------------------

/** Where an address goes when neither the network nor its own /24 can place it. */
const FALLBACK_SUBNET = "0.0.0.0/0";

/** How far along a discovered host is, as one of the map's four looks. */
export function hostMapState(host: DiscoveredHost): TopologyNodeState {
  if (host.accessed) return "accessed";
  if (host.portScanned || Object.keys(host.services).length > 0) return "enumerated";
  return host.answered ? "detected" : "unknown";
}

/**
 * The learner's map of the network, built from discovery state alone. A host, address, name,
 * service, OS guess or subnet the learner hasn't seen is never in the result, in any form, and the
 * counts only say what has been found, never what's left.
 *
 * Ground truth is read for exactly two things, both about addresses already in discovery state:
 * which subnet a seen address sits in (knowing an address means knowing its network), and that
 * subnet's name. Pure: the same state always gives an equal result, and nothing is mutated.
 */
export function selectTopology(
  state: Pick<SimState, "discovery" | "network" | "session">,
): DiscoveredTopology {
  const { discovery, network } = state;
  const sessionHostId = state.session.hostId;

  const nodes = Object.values(discovery.hosts)
    // Every recorded host has an address; a hand-edited snapshot might not, and can't be placed.
    .filter((host) => host.ips.length > 0)
    .map((host) => toNode(network, host, sessionHostId))
    .sort(compareNodes);

  const seenSubnets = new Set<string>();
  const placed = new Map<string, string[]>();
  for (const node of nodes) {
    for (const cidr of node.subnets) seenSubnets.add(cidr);
    const home = node.subnets[0] as string;
    const here = placed.get(home);
    if (here) here.push(node.hostId);
    else placed.set(home, [node.hostId]);
  }
  const sessionNode = nodes.find((node) => node.isSessionHost);
  const sessionSubnets = new Set(sessionNode?.subnets ?? []);

  const subnets = [...seenSubnets].sort(compareCidrs).map((cidr): TopologySubnet => {
    const name = network.subnets.find((subnet) => subnet.cidr === cidr)?.name;
    return {
      cidr,
      ...(name !== undefined && { name }),
      hostIds: placed.get(cidr) ?? [],
      containsSessionHost: sessionSubnets.has(cidr),
    };
  });

  const links: TopologyLink[] = [];
  const from = sessionNode?.subnets[0];
  if (from !== undefined) {
    // A network counts as reached once something in it has answered the learner. A host only
    // heard of in the briefing proves nothing about reachability.
    const reached = new Set<string>();
    for (const node of nodes) {
      if (node.isSessionHost || node.state === "unknown") continue;
      for (const cidr of node.subnets) if (!sessionSubnets.has(cidr)) reached.add(cidr);
    }
    for (const to of [...reached].sort(compareCidrs)) links.push({ kind: "route", from, to });
  }
  for (const node of nodes) {
    for (const subnet of node.subnets.slice(1)) {
      links.push({ kind: "interface", hostId: node.hostId, subnet });
    }
  }

  const byState: Record<TopologyNodeState, number> = {
    unknown: 0,
    detected: 0,
    enumerated: 0,
    accessed: 0,
  };
  for (const node of nodes) byState[node.state] += 1;

  return {
    nodes,
    subnets,
    links,
    sessionHostId,
    counts: {
      hosts: nodes.length,
      found: nodes.filter((node) => !node.isSessionHost && node.state !== "unknown").length,
      services: nodes.reduce((sum, node) => sum + node.services.length, 0),
      byState,
    },
  };
}

function toNode(network: NetworkGraph, host: DiscoveredHost, sessionHostId: string): TopologyNode {
  const ips = [...host.ips].sort(compareIps);
  const subnets = [...new Set(ips.map((ip) => subnetOf(network, host.hostId, ip)))];
  const firstIp = ips[0] as string;
  const label = host.hostname ? (host.hostname.split(".")[0] ?? "") || host.hostname : firstIp;
  return {
    hostId: host.hostId,
    label,
    ...(host.hostname !== undefined && { hostname: host.hostname }),
    ips,
    subnets,
    state: hostMapState(host),
    ...(host.osGuess !== undefined && { osGuess: host.osGuess }),
    services: Object.values(host.services).sort(
      (a, b) => a.port - b.port || compareText(a.protocol, b.protocol),
    ),
    firstSeenTick: host.firstSeenTick,
    via: host.via,
    isSessionHost: host.hostId === sessionHostId,
  };
}

/**
 * The subnet a seen address belongs to: the interface's own subnet. Only a snapshot whose
 * discovery and network disagree lands in the fallbacks: the narrowest listed subnet holding the
 * address, then the address's /24.
 */
function subnetOf(network: NetworkGraph, hostId: string, ip: string): string {
  const iface = hostById(network, hostId)?.interfaces.find((candidate) => candidate.ip === ip);
  if (iface) return iface.subnet;
  const address = parseIpv4(ip);
  if (address === undefined) return FALLBACK_SUBNET;
  let best: { cidr: string; prefix: number } | undefined;
  for (const { cidr } of network.subnets) {
    const range = parseCidr(cidr);
    if (range && cidrContains(range, address) && (!best || range.prefix > best.prefix)) {
      best = { cidr, prefix: range.prefix };
    }
  }
  return best?.cidr ?? formatCidr({ base: (address & maskFor(24)) >>> 0, prefix: 24 });
}

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const compareNodes = (a: TopologyNode, b: TopologyNode): number =>
  compareIps(a.ips[0] as string, b.ips[0] as string) || compareText(a.hostId, b.hostId);

function compareCidrs(a: string, b: string): number {
  const x = parseCidr(a);
  const y = parseCidr(b);
  return (
    (x?.base ?? 0) - (y?.base ?? 0) || (x?.prefix ?? 0) - (y?.prefix ?? 0) || compareText(a, b)
  );
}
