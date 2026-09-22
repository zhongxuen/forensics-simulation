/**
 * pnpm security:bundle
 *
 * Proves no secret or server-only code reached the browser (md-files/11-testing-security-deployment.md,
 * prompt 11.2: "grep the built client bundle for secrets"). Run it after `pnpm build`. It reads
 * everything a browser can download (every file under .next/static, and every pre-rendered page
 * and its RSC payload under .next/server/app) and fails if any of them contains:
 *
 * - the name of a server-only environment variable (ANTHROPIC_API_KEY, MENTOR_DISABLED, MENTOR_MODEL);
 * - an Anthropic key's shape (sk-ant-…), or the value of ANTHROPIC_API_KEY if this shell has one;
 * - the Anthropic API's address or its SDK (only the server may talk to the model).
 *
 * The same check as shell one-liners, for a quick look by hand (both print nothing when clean):
 *
 *   grep -rlE "ANTHROPIC_API_KEY|MENTOR_DISABLED|MENTOR_MODEL|sk-ant-" .next/static .next/server/app
 *   grep -rlE "api\.anthropic\.com|@anthropic-ai/sdk|anthropic-version" .next/static .next/server/app
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const STATIC_DIR = join(ROOT, ".next/static");
const PAGES_DIR = join(ROOT, ".next/server/app");

/** What must never reach the browser, and why. */
const FORBIDDEN: readonly { readonly pattern: RegExp; readonly what: string }[] = [
  { pattern: /ANTHROPIC_API_KEY/, what: "the API key's variable name" },
  { pattern: /MENTOR_DISABLED|MENTOR_MODEL/, what: "a server-only mentor variable" },
  { pattern: /sk-ant-[A-Za-z0-9_-]{8,}/, what: "something shaped like an Anthropic API key" },
  { pattern: /api\.anthropic\.com/, what: "the Anthropic API's address" },
  { pattern: /@anthropic-ai\/sdk|anthropic-version/, what: "the Anthropic SDK" },
];

/** Files a browser can receive: scripts, styles, pages, and the payloads pages load. */
function browserFiles(dir: string, pages: boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Route handlers run on the server; their compiled code under .next/server/app/api is never sent.
      return pages && entry.name === "api" ? [] : browserFiles(path, pages);
    }
    if (!pages) return /\.(?:js|css|json|txt|map)$/.test(entry.name) ? [path] : [];
    return /\.(?:html|rsc|body|meta)$/.test(entry.name) || entry.name.endsWith(".segments")
      ? [path]
      : [];
  });
}

function main() {
  if (!existsSync(STATIC_DIR)) {
    console.error("No production build found. Run `pnpm build` first.");
    process.exit(1);
  }
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  const checks = [
    ...FORBIDDEN,
    ...(key
      ? [
          {
            pattern: new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
            what: "the actual API key",
          },
        ]
      : []),
  ];

  const files = [...browserFiles(STATIC_DIR, false), ...browserFiles(PAGES_DIR, true)];
  const leaks: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const { pattern, what } of checks) {
      if (pattern.test(text)) leaks.push(`${relative(ROOT, file).replaceAll("\\", "/")}: ${what}`);
    }
  }

  console.log(
    `Checked ${files.length} files a browser can download${key ? ", including for this shell's API key" : ""}.`,
  );
  if (leaks.length > 0) {
    console.error(
      `\nFound what must stay on the server:\n${leaks.map((line) => `- ${line}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log("Clean: no secret, server-only variable, model address or SDK in the client bundle.");
}

main();
