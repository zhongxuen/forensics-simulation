/** Ground-truth queries over the network graph: lookups and reachability. */
import { cidrContains, compareIps, parseCidr, parseIpv4 } from "./ip";
import type { Host, NetworkGraph, NetworkInterface, OsProfile, Service } from "./types";

export function hostById(net: NetworkGraph, id: string): Host | undefined {
  return Object.hasOwn(net.hosts, id) ? net.hosts[id] : undefined;
}

/** All hosts, sorted by their first address. */
export function allHosts(net: NetworkGraph): Host[] {
  return Object.values(net.hosts).sort((a, b) => compareIps(primaryIp(a), primaryIp(b)));
}

export const primaryIp = (host: Host): string => host.interfaces[0]?.ip ?? "0.0.0.0";

/** The host that owns an address, and the interface it's on. */
export function hostByIp(
  net: NetworkGraph,
  ip: string,
): { host: Host; iface: NetworkInterface } | undefined {
  for (const host of Object.values(net.hosts)) {
    const iface = host.interfaces.find((candidate) => candidate.ip === ip);
    if (iface) return { host, iface };
  }
  return undefined;
}

/**
 * Finds a host by name, case-insensitively: the full name ("web-01.corp.example") or its first
 * label ("web-01"), like a local DNS search domain would.
 */
export function resolveHostname(net: NetworkGraph, name: string): Host | undefined {
  const wanted = name.toLowerCase().replace(/\.$/, "");
  const hosts = Object.values(net.hosts);
  return (
    hosts.find((host) => host.hostname.toLowerCase() === wanted) ??
    hosts.find((host) => host.hostname.toLowerCase().split(".")[0] === wanted)
  );
}

/** Whether one rule ("*", a host id, or a CIDR range) lets `from` in. */
export function ruleAllows(rule: string, from: Host): boolean {
  if (rule === "*") return true;
  if (rule === from.id) return true;
  const range = rule.includes("/") ? parseCidr(rule, { strict: true }) : undefined;
  if (!range) return false;
  return from.interfaces.some(({ ip }) => {
    const address = parseIpv4(ip);
    return address !== undefined && cidrContains(range, address);
  });
}

/**
 * Whether traffic from `fromId` gets to `toId` (and, given a service, to that port). A host can
 * always reach itself. A service's own rule, when it has one, replaces the host's rule.
 */
export function canReach(
  net: NetworkGraph,
  fromId: string,
  toId: string,
  service?: Service,
): boolean {
  const from = hostById(net, fromId);
  const to = hostById(net, toId);
  if (!from || !to) return false;
  if (from.id === to.id) return true;
  const rules = service?.reachableFrom ?? to.reachableFrom;
  return rules.some((rule) => ruleAllows(rule, from));
}

/** Every other host that `fromHostId` can reach, sorted by address. */
export function reachableHosts(net: NetworkGraph, fromHostId: string): Host[] {
  return allHosts(net).filter(
    (host) => host.id !== fromHostId && canReach(net, fromHostId, host.id),
  );
}

/** A host's services, sorted by port then protocol. Empty for an unknown host. */
export function servicesOn(net: NetworkGraph, hostId: string): readonly Service[] {
  return hostById(net, hostId)?.services ?? [];
}

export function serviceAt(host: Host, port: number, protocol = "tcp"): Service | undefined {
  return host.services.find((service) => service.port === port && service.protocol === protocol);
}

/** What a scan can tell about a host's OS: a rough family guess, never the exact version. */
export function osGuess(os: OsProfile): string {
  switch (os.family) {
    case "linux":
      return "Linux";
    case "windows":
      return "Windows";
    case "bsd":
      return "BSD";
    case "macos":
      return "macOS";
    case "embedded":
      return "embedded device";
    default:
      return "unknown";
  }
}
