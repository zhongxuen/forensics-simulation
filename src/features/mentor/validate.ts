/**
 * Server-side validation of the mentor's output before a single character reaches the client
 * (docs/plan/14-mentor.md §Spec). It is a backstop, never the only defence: the
 * model is never given a case's answer key or any real target, so the worst it can do is rephrase
 * an authored hint. This check catches the case where a prompt-injection attempt nudges it toward
 * something shell-executable or a real-world target anyway.
 *
 * A rejection means the request falls back to the authored tier text; nothing is shown as an error.
 *
 * The check runs on the accumulated model text as it streams, so a bad pattern that only completes
 * in an unreleased tail still trips it before the completing chunk is released.
 */

/** Why the output was rejected: metadata for the log line, never player text. */
export interface MentorValidationResult {
  readonly ok: boolean;
  readonly reason?: string;
}

const OK: MentorValidationResult = { ok: true };

/**
 * Shell-executable payload patterns: reverse shells, pipe-to-shell download cradles, destructive
 * commands, base64-piped-to-shell, PowerShell download cradles, and offensive tooling by name. These
 * are the shapes a hint about a simulated haulage yard's disk image never needs, so any of them is a
 * rejection. This is a blue-team game: nothing the mentor says ever needs to be runnable at all.
 */
const PAYLOAD_PATTERNS: readonly { readonly re: RegExp; readonly reason: string }[] = [
  { re: /\/dev\/tcp\//i, reason: "reverse_shell" },
  { re: /\b(?:bash|sh|zsh)\s+-[a-z]*i\b/i, reason: "reverse_shell" },
  { re: /\bn(?:et)?c(?:at)?\b[^\n]*\s-[a-z]*e\b/i, reason: "reverse_shell" },
  { re: /\bmkfifo\b[\s\S]*\bnc\b/i, reason: "reverse_shell" },
  { re: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/i, reason: "curl_pipe_shell" },
  { re: /\bbase64\b[^\n|]*(?:-d|--decode)[^\n|]*\|\s*(?:ba)?sh\b/i, reason: "base64_pipe_shell" },
  { re: /\|\s*base64\s+(?:-d|--decode)\b[\s\S]*\|\s*(?:ba)?sh\b/i, reason: "base64_pipe_shell" },
  {
    re: /\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+(?:--no-preserve-root\s+)?\/(?=[\s`'"*)]|$)/i,
    reason: "rm_rf_root",
  },
  {
    re: /\brm\s+-[a-z]*f[a-z]*r[a-z]*\s+(?:--no-preserve-root\s+)?\/(?=[\s`'"*)]|$)/i,
    reason: "rm_rf_root",
  },
  {
    re: /(?:iex|invoke-expression)\b[\s\S]*(?:new-object|downloadstring|downloadfile|webclient)/i,
    reason: "powershell_cradle",
  },
  {
    re: /(?:new-object|downloadstring|downloadfile|webclient)[\s\S]*(?:iex|invoke-expression)/i,
    reason: "powershell_cradle",
  },
  {
    re: /\bpowershell(?:\.exe)?\b[^\n]*\s-(?:enc|e|encodedcommand)\b/i,
    reason: "powershell_cradle",
  },
  {
    re: /\b(?:msfvenom|meterpreter|metasploit|msfconsole|cobalt\s*strike|sliver\s+c2)\b/i,
    reason: "offensive_tooling",
  },
  { re: /\bsetoolkit\b|\bempire\b\s+(?:agent|stager|launcher)/i, reason: "offensive_tooling" },
];

/** SQL-injection payload strings. Discussing "an injection" is fine; a ready-to-paste one is not. */
const SQLI_PATTERNS: readonly RegExp[] = [
  /(?:'|")\s*or\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i,
  /\bunion\s+(?:all\s+)?select\b/i,
  /(?:'|")\s*;\s*drop\s+table\b/i,
  /\bor\s+1\s*=\s*1\b/i,
];

// Reserved and non-routable IPv4 ranges the simulated scenarios use, plus loopback/link-local and
// the documentation ranges. Anything else that parses as an IPv4 address is treated as a real target.
function isReservedIpv4(a: number, b: number): boolean {
  if (a === 10) return true; // 10.0.0.0/8 (private)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (private)
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 (private)
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 0) return true; // "this host"
  return false;
}
function isDocumentationIpv4(a: number, b: number, c: number): boolean {
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 (RFC 5737)
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24
  return false;
}

const IPV4_RE = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;

function hasRealIpv4(text: string): boolean {
  for (const match of text.matchAll(IPV4_RE)) {
    const parts = match.slice(1, 5).map(Number);
    if (parts.some((n) => n > 255)) continue; // not a valid dotted quad
    const [a, b, c] = parts as [number, number, number, number];
    if (isReservedIpv4(a, b) || isDocumentationIpv4(a, b, c)) continue;
    return true;
  }
  return false;
}

// A rough IPv6 detector. Loopback (::1), the unspecified address, and link-local/unique-local
// prefixes are allowed; any other IPv6 literal is treated as a real target. A candidate only counts
// as IPv6 if it uses "::", contains a hex letter, or has six or more groups — so an all-numeric
// clock time like "02:14:07" (common in log output the mentor may quote) is never mistaken for one.
const IPV6_RE = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b|::[0-9a-f]{1,4}\b/gi;
function hasRealIpv6(text: string): boolean {
  for (const match of text.matchAll(IPV6_RE)) {
    const value = match[0].toLowerCase();
    const groups = value.split(":").filter((group) => group !== "");
    const looksLikeIpv6 = value.includes("::") || /[a-f]/.test(value) || groups.length >= 6;
    if (!looksLikeIpv6) continue;
    if (
      value === "::1" ||
      value === "::" ||
      value.startsWith("fe80:") ||
      value.startsWith("fc") ||
      value.startsWith("fd")
    ) {
      continue;
    }
    return true;
  }
  return false;
}

/** CVE identifiers: hints teach concepts, they don't point at a specific real-world vulnerability. */
const CVE_RE = /\bCVE-\d{4}-\d{3,7}\b/i;

// Top-level labels that are safe: the documentation TLDs (RFC 2606 / 6761) the story uses, and
// `local`/`localhost`. Everything else that looks like a hostname is treated as a real domain.
const SAFE_TLDS = new Set(["example", "test", "invalid", "local", "localhost"]);

// Common file extensions, so `index.html`, `database.conf` or `site.log` in a hint aren't mistaken
// for a domain name. The simulated tool and command names never contain a dot, so they need no entry.
const FILE_EXTENSIONS = new Set([
  "html",
  "htm",
  "txt",
  "conf",
  "cfg",
  "ini",
  "log",
  "json",
  "yaml",
  "yml",
  "md",
  "markdown",
  "sh",
  "bash",
  "zsh",
  "py",
  "js",
  "ts",
  "jsx",
  "tsx",
  "css",
  "scss",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "pdf",
  "csv",
  "tsv",
  "bak",
  "old",
  "db",
  "sqlite",
  "sql",
  "xml",
  "env",
  "gz",
  "tar",
  "tgz",
  "zip",
  "key",
  "pem",
  "crt",
  "cer",
  "pub",
  "service",
  "socket",
  "sock",
  "lock",
  "pid",
  "tmp",
  "d",
  "properties",
  "toml",
  "lst",
  "list",
  "dat",
  "bin",
  "exe",
  "dll",
  "img",
  "iso",
  "php",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "h",
  "cpp",
  "htaccess",
]);

// A hostname-shaped token: labels separated by dots, ending in a letters-only TLD. Numeric-only
// final labels (an IPv4 tail) never match because the TLD must be letters.
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63})\b/gi;

function hasRealDomain(text: string): boolean {
  for (const match of text.matchAll(DOMAIN_RE)) {
    const tld = match[1]?.toLowerCase();
    if (tld === undefined) continue;
    if (SAFE_TLDS.has(tld)) continue; // *.example, *.test, localhost, ...
    if (FILE_EXTENSIONS.has(tld)) continue; // index.html, database.conf, ...
    return true;
  }
  return false;
}

/**
 * Validates the mentor's output. Accepts the hints this game actually gives (`hashsum --verify`,
 * `lsfs image`, `logq --source security`, a SHA-256 digest, a reserved address like `10.60.0.21`,
 * a log time like `19:42:03`); rejects shell-executable payloads, SQL-injection strings, and
 * anything that names a real-world target (a public IP, a real domain, or a CVE id).
 */
export function validateMentorOutput(text: string): MentorValidationResult {
  for (const { re, reason } of PAYLOAD_PATTERNS) {
    if (re.test(text)) return { ok: false, reason };
  }
  for (const re of SQLI_PATTERNS) {
    if (re.test(text)) return { ok: false, reason: "sqli_payload" };
  }
  if (hasRealIpv4(text)) return { ok: false, reason: "real_ipv4" };
  if (hasRealIpv6(text)) return { ok: false, reason: "real_ipv6" };
  if (CVE_RE.test(text)) return { ok: false, reason: "cve_reference" };
  if (hasRealDomain(text)) return { ok: false, reason: "real_domain" };
  return OK;
}
