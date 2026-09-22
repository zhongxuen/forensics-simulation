/** Hostname rules. Scenario hostnames must be fictional so nothing ever names a real machine. */

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * Domains reserved so they never point at a real organisation (RFC 2606, RFC 6761, RFC 8375, and
 * ICANN's ".internal").
 */
export const RESERVED_DOMAINS = [
  "example",
  "example.com",
  "example.net",
  "example.org",
  "test",
  "invalid",
  "localhost",
  "internal",
  "local",
  "home.arpa",
] as const;

export function isValidHostname(name: string): boolean {
  return (
    name.length > 0 && name.length <= 253 && name.split(".").every((label) => LABEL.test(label))
  );
}

/** A single label ("web-01"), or a name under a reserved domain ("web-01.corp.example"). */
export function isFictionalHostname(name: string): boolean {
  if (!isValidHostname(name)) return false;
  const lower = name.toLowerCase();
  if (!lower.includes(".")) return true;
  return RESERVED_DOMAINS.some((domain) => lower === domain || lower.endsWith(`.${domain}`));
}
