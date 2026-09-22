/**
 * Turns a declarative network spec into the ground-truth NetworkGraph, checking that everything is
 * fictional and consistent. Throws a ScenarioError listing every problem.
 */
import { ProblemList } from "../core/scenario-error";
import { compareNames } from "../fs/tree";
import {
  cidrContains,
  compareIps,
  formatCidr,
  isReservedIp,
  isReservedRange,
  parseCidr,
  parseIpv4,
} from "./ip";
import { isFictionalHostname } from "./names";
import type { Host, HostSpec, NetworkGraph, NetworkSpec, Service, Subnet } from "./types";

const HOST_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SERVICE_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function buildNetwork(spec: NetworkSpec): NetworkGraph {
  const problems = new ProblemList();
  const hostIds = new Set(spec.hosts.map((host) => host.id));
  const seenIds = new Set<string>();
  const seenIps = new Map<string, string>();
  const seenNames = new Map<string, string>();
  const subnets = new Map<string, Subnet>();

  for (const subnet of spec.subnets ?? []) {
    const cidr = parseCidr(subnet.cidr, { strict: true });
    if (!cidr) problems.add(`subnet "${subnet.cidr}" should be a network range like "10.0.1.0/24"`);
    else if (!isReservedRange(cidr))
      problems.add(`subnet "${subnet.cidr}" is not a reserved range`);
    else
      subnets.set(
        formatCidr(cidr),
        subnet.name ? { cidr: formatCidr(cidr), name: subnet.name } : { cidr: formatCidr(cidr) },
      );
  }

  const hosts: Record<string, Host> = {};
  for (const hostSpec of spec.hosts) {
    const where = `host "${hostSpec.id}"`;
    if (!HOST_ID.test(hostSpec.id))
      problems.add(`${where}: ids are lowercase letters, digits and "-"`);
    if (seenIds.has(hostSpec.id)) problems.add(`${where} is defined twice`);
    seenIds.add(hostSpec.id);

    const name = hostSpec.hostname.toLowerCase();
    if (!isFictionalHostname(hostSpec.hostname)) {
      problems.add(
        `${where}: hostname "${hostSpec.hostname}" must be one word or end in a reserved domain like ".example"`,
      );
    }
    const shortName = name.split(".")[0] as string;
    for (const key of new Set([name, shortName])) {
      const other = seenNames.get(key);
      if (other && other !== hostSpec.id)
        problems.add(`${where}: hostname "${key}" is also used by "${other}"`);
      seenNames.set(key, hostSpec.id);
    }

    if (hostSpec.interfaces.length === 0) problems.add(`${where} needs at least one interface`);
    for (const { ip, subnet } of hostSpec.interfaces) {
      const address = parseIpv4(ip);
      const range = parseCidr(subnet, { strict: true });
      if (address === undefined) problems.add(`${where}: "${ip}" is not an IPv4 address`);
      else if (!isReservedIp(address))
        problems.add(
          `${where}: ${ip} is outside the reserved ranges; use 10.x, 172.16.x or 192.168.x`,
        );
      if (!range)
        problems.add(`${where}: subnet "${subnet}" should be a network range like "10.0.1.0/24"`);
      if (address !== undefined && range && !cidrContains(range, address)) {
        problems.add(`${where}: ${ip} is not inside ${subnet}`);
      }
      const owner = seenIps.get(ip);
      if (owner) problems.add(`${where}: ${ip} is already used by "${owner}"`);
      seenIps.set(ip, hostSpec.id);
      if (range && isReservedRange(range) && !subnets.has(formatCidr(range))) {
        subnets.set(formatCidr(range), { cidr: formatCidr(range) });
      }
    }

    const reachableFrom = hostSpec.reachableFrom ?? hostSpec.interfaces.map((i) => i.subnet);
    checkRules(reachableFrom, hostIds, `${where} reachableFrom`, problems);

    const seenPorts = new Set<string>();
    for (const service of hostSpec.services ?? []) {
      const port = `${service.port}/${service.protocol}`;
      if (!Number.isInteger(service.port) || service.port < 1 || service.port > 65535) {
        problems.add(`${where}: port ${service.port} must be 1-65535`);
      }
      if (seenPorts.has(port)) problems.add(`${where}: ${port} is defined twice`);
      seenPorts.add(port);
      if (!SERVICE_NAME.test(service.name))
        problems.add(`${where} ${port}: service name "${service.name}" should be lowercase`);
      if (service.reachableFrom)
        checkRules(service.reachableFrom, hostIds, `${where} ${port} reachableFrom`, problems);
      if (service.http && !["http", "https"].includes(service.name)) {
        problems.add(`${where} ${port}: only "http" or "https" services can have web pages`);
      }
      for (const path of Object.keys(service.http?.pages ?? {})) {
        if (!path.startsWith("/"))
          problems.add(`${where} ${port}: page path "${path}" should start with "/"`);
      }
    }

    hosts[hostSpec.id] = toHost(hostSpec, reachableFrom);
  }
  problems.throwIfAny("network is not valid");

  const sortedIds = Object.keys(hosts).sort(compareNames);
  return {
    subnets: [...subnets.values()].sort((a, b) =>
      compareIps(a.cidr.split("/")[0] as string, b.cidr.split("/")[0] as string),
    ),
    hosts: Object.fromEntries(sortedIds.map((id) => [id, hosts[id] as Host])),
  };
}

function toHost(spec: HostSpec, reachableFrom: readonly string[]): Host {
  const services = [...(spec.services ?? [])].sort(compareServices).map(normalizeService);
  return {
    id: spec.id,
    hostname: spec.hostname,
    interfaces: spec.interfaces.map(({ ip, subnet }) => ({ ip, subnet })),
    os: { ...spec.os },
    services,
    reachableFrom: [...reachableFrom],
    respondsToPing: spec.respondsToPing ?? true,
  };
}

function normalizeService(service: Service): Service {
  // Copy only known fields, so a snapshot never carries stray keys from content.
  return {
    port: service.port,
    protocol: service.protocol,
    name: service.name,
    product: service.product,
    version: service.version,
    ...(service.banner !== undefined && { banner: service.banner }),
    ...(service.reachableFrom !== undefined && { reachableFrom: [...service.reachableFrom] }),
    ...(service.http !== undefined && { http: service.http }),
  };
}

export const compareServices = (a: Service, b: Service): number =>
  a.port - b.port || compareNames(a.protocol, b.protocol);

/** Rules are "*", a host id, or a CIDR range. */
function checkRules(
  rules: readonly string[],
  hostIds: ReadonlySet<string>,
  where: string,
  problems: ProblemList,
): void {
  for (const rule of rules) {
    if (rule === "*" || hostIds.has(rule)) continue;
    if (rule.includes("/")) {
      if (!parseCidr(rule, { strict: true }))
        problems.add(`${where}: "${rule}" is not a network range like "10.0.1.0/24"`);
      continue;
    }
    problems.add(`${where}: "${rule}" is not "*", a host id, or a network range`);
  }
}
