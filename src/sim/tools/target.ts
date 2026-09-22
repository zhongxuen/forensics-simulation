/**
 * Turns what a learner typed ("10.0.1.0/24", "web-01", "http://web-01:8080/admin") into a target
 * on the simulated network. Anything outside the reserved address ranges, or a real-looking domain,
 * is OUT_OF_SCOPE: the engine refuses it by name, and nothing is ever sent anywhere.
 */
import { err, ok, type Result } from "../core/result";
import type { SimError } from "../core/errors";
import { hostByIp, primaryIp, resolveHostname } from "../net/graph";
import {
  cidrSize,
  formatCidr,
  isReservedIp,
  isReservedRange,
  parseCidr,
  parseIpv4,
  type Cidr,
} from "../net/ip";
import { isFictionalHostname, isValidHostname } from "../net/names";
import type { Host, NetworkGraph } from "../net/types";

/** Scans may cover at most a /16 (65,536 addresses). */
export const LARGEST_SCAN_PREFIX = 16;
const MAX_TARGET_LENGTH = 253;

export interface ScanTarget {
  readonly range: Cidr;
  /** How to show the target: the range, or "10.0.1.20 (web-01)". */
  readonly label: string;
  readonly addressCount: number;
}

export function parseScanTarget(
  net: NetworkGraph,
  raw: string,
  argument = "target",
): Result<ScanTarget, SimError> {
  const bad = (reason: "bad-format" | "range-too-large" | "too-long") =>
    err<SimError>({ code: "BAD_ARGUMENT", argument, value: raw, reason });
  if (raw.length > MAX_TARGET_LENGTH) return bad("too-long");

  if (raw.includes("/")) {
    const range = parseCidr(raw);
    if (!range) return bad("bad-format");
    if (range.prefix < LARGEST_SCAN_PREFIX) return bad("range-too-large");
    if (!isReservedRange(range)) return err({ code: "OUT_OF_SCOPE", target: raw });
    return ok({ range, label: formatCidr(range), addressCount: cidrSize(range) });
  }

  const ip = parseIpv4(raw);
  if (ip !== undefined) {
    if (!isReservedIp(ip)) return err({ code: "OUT_OF_SCOPE", target: raw });
    // Just the address: naming the host here would leak it even if it never answers.
    return ok({ range: { base: ip, prefix: 32 }, label: raw, addressCount: 1 });
  }

  const host = lookupName(net, raw, argument);
  if (!host.ok) return host;
  const address = primaryIp(host.value);
  return ok({
    range: { base: parseIpv4(address) as number, prefix: 32 },
    label: `${address} (${host.value.hostname})`,
    addressCount: 1,
  });
}

export interface Endpoint {
  readonly host: Host;
  /** The address used to reach it. */
  readonly ip: string;
  /** What the learner typed for the host part, for error messages. */
  readonly display: string;
}

/** Resolves one host by address or name. An address with no host behind it is unreachable. */
export function resolveEndpoint(
  net: NetworkGraph,
  raw: string,
  port: number | undefined,
  argument = "target",
): Result<Endpoint, SimError> {
  if (raw.length > MAX_TARGET_LENGTH) {
    return err({ code: "BAD_ARGUMENT", argument, value: raw, reason: "too-long" });
  }
  const ip = parseIpv4(raw);
  if (ip !== undefined) {
    if (!isReservedIp(ip)) return err({ code: "OUT_OF_SCOPE", target: raw });
    const found = hostByIp(net, raw);
    if (!found) {
      return err(
        port === undefined
          ? { code: "HOST_UNREACHABLE", target: raw }
          : { code: "HOST_UNREACHABLE", target: raw, port },
      );
    }
    return ok({ host: found.host, ip: raw, display: raw });
  }
  const host = lookupName(net, raw, argument);
  if (!host.ok) return host;
  return ok({ host: host.value, ip: primaryIp(host.value), display: raw });
}

function lookupName(net: NetworkGraph, raw: string, argument: string): Result<Host, SimError> {
  if (/^[\d.]+$/.test(raw) || !isValidHostname(raw)) {
    return err({ code: "BAD_ARGUMENT", argument, value: raw, reason: "bad-format" });
  }
  const host = resolveHostname(net, raw);
  if (host) return ok(host);
  // A real-looking domain is out of scope; an unknown fictional name just doesn't exist here.
  return err(
    isFictionalHostname(raw)
      ? { code: "HOST_NOT_FOUND", target: raw }
      : { code: "OUT_OF_SCOPE", target: raw },
  );
}
