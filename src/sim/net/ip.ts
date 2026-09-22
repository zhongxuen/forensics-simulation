/** IPv4 addresses and CIDR ranges as unsigned 32-bit numbers. Parsing only; nothing is ever sent. */

export interface Cidr {
  /** Network address (host bits cleared). */
  readonly base: number;
  readonly prefix: number;
}

/** Strict dotted-quad parsing: four decimal parts 0-255, no leading zeros. */
export function parseIpv4(text: string): number | undefined {
  const parts = text.split(".");
  if (parts.length !== 4) return undefined;
  let value = 0;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return undefined;
    const octet = Number(part);
    if (octet > 255) return undefined;
    value = value * 256 + octet;
  }
  return value;
}

export function formatIpv4(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

export function maskFor(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * "10.0.1.0/24" to a range. With `strict`, the address must be the network address itself
 * (10.0.1.5/24 is rejected); otherwise host bits are cleared (10.0.1.5/24 means 10.0.1.0/24).
 */
export function parseCidr(text: string, options: { strict?: boolean } = {}): Cidr | undefined {
  const match = /^([^/]+)\/(0|[1-9]\d?)$/.exec(text);
  if (!match) return undefined;
  const ip = parseIpv4(match[1] as string);
  const prefix = Number(match[2]);
  if (ip === undefined || prefix > 32) return undefined;
  const base = (ip & maskFor(prefix)) >>> 0;
  if (options.strict && base !== ip) return undefined;
  return { base, prefix };
}

export const formatCidr = (cidr: Cidr): string => `${formatIpv4(cidr.base)}/${cidr.prefix}`;

export function cidrContains(cidr: Cidr, ip: number): boolean {
  const mask = maskFor(cidr.prefix);
  return (ip & mask) >>> 0 === cidr.base;
}

/** How many addresses a range covers. */
export const cidrSize = (cidr: Cidr): number => 2 ** (32 - cidr.prefix);

/**
 * Address ranges that can never be a real target on the internet: private networks, loopback,
 * link-local, benchmarking, and the documentation ranges. Scenarios may only use these.
 */
export const RESERVED_RANGES: readonly Cidr[] = [
  "10.0.0.0/8",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
].map((text) => parseCidr(text, { strict: true }) as Cidr);

export const isReservedIp = (ip: number): boolean =>
  RESERVED_RANGES.some((range) => cidrContains(range, ip));

/** True when every address in `cidr` is inside one reserved range. */
export const isReservedRange = (cidr: Cidr): boolean =>
  RESERVED_RANGES.some((range) => range.prefix <= cidr.prefix && cidrContains(range, cidr.base));

/** Numeric comparison of dotted-quad strings, for sorting hosts by address. */
export function compareIps(a: string, b: string): number {
  return (parseIpv4(a) ?? 0) - (parseIpv4(b) ?? 0);
}
