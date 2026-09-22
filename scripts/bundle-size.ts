/**
 * pnpm bundle:check [--update] [--json]
 *
 * The initial-JavaScript budget (md-files/11-testing-security-deployment.md, prompt 11.3). Run it
 * after `pnpm build`. For every page the build prerendered, it reads the HTML, collects every
 * script that page loads before the learner can do anything (the `<script src>` tags and the
 * script preloads), and adds up their gzipped sizes. Chunks a page loads later, on demand (the
 * terminal and the network map, once a mission starts), don't count: that's the point of splitting
 * them out.
 *
 * It fails (exit 1) when:
 *  - a page's initial JS is over the budget (200 KB gzipped);
 *  - a page grew more than the tolerance over the baseline in scripts/bundle-baseline.json;
 *  - a page loads the terminal, the network map or the simulation engine up front when it isn't
 *    allowed to (HEAVY_MODULES below).
 *
 * `--update` rewrites the baseline from this build. Commit that change with the reason in the
 * message, so every increase is a decision someone made on purpose.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = join(__dirname, "..");
const APP_DIR = join(ROOT, ".next/server/app");
const STATIC_DIR = join(ROOT, ".next");
const BASELINE_FILE = join(__dirname, "bundle-baseline.json");

/** The budget for initial JS per page, gzipped (prompt 11.3: "initial JS < 200KB gzipped"). */
export const INITIAL_JS_BUDGET_BYTES = 200 * 1024;

/** How much a page may grow over the baseline before the check fails. */
const TOLERANCE_BYTES = 2 * 1024;

/** Pages that are never shown to a learner in production. */
const SKIP = new Set(["/_global-error", "/styleguide"]);

/**
 * Code that must stay out of a page's first load unless the page shows it straight away. Each is
 * found by a string only that code contains, which survives minification. `allowed` lists the
 * pages that may load it up front (a regular expression over the route).
 */
const HEAVY_MODULES: readonly {
  name: string;
  marker: string;
  allowed: RegExp;
}[] = [
  // The terminal, the network map and the simulation engine load on demand everywhere: a mission
  // loads them when Start mission is pressed (warming them up during the briefing), and /terminal,
  // /sandbox and lessons with a practice terminal fetch them as the page hydrates (React.lazy
  // inside Suspense: the server still renders them, so nothing moves). No page needs them up front.
  { name: "the terminal", marker: "Reset machine", allowed: /^$/ },
  { name: "the network map", marker: "Zoom in", allowed: /^$/ },
  { name: "the simulation engine", marker: "like opening it in a file browser", allowed: /^$/ },
  // Full Zod can't be tree-shaken and adds ~90 KB gzipped, with every language's error messages
  // (this marker is one of the Finnish ones). Browser code uses zod/mini, or no Zod at all.
  { name: "the full Zod build", marker: "Tuntemattomat avaimet", allowed: /^$/ },
];

interface PageSize {
  readonly route: string;
  readonly bytes: number;
  readonly scripts: readonly string[];
  readonly heavy: readonly string[];
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

function routeOf(file: string): string {
  const path = relative(APP_DIR, file)
    .replaceAll("\\", "/")
    .replace(/\.html$/, "");
  return path === "index" ? "/" : `/${path}`;
}

/** Every script the page loads on first paint: `<script src>` and `<link rel=preload as=script>`. */
function scriptsIn(html: string): string[] {
  const found = new Set<string>();
  for (const [, src] of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) found.add(src!);
  for (const [tag] of html.matchAll(/<link\b[^>]*>/g)) {
    if (/\bas="script"/.test(tag) || /\brel="modulepreload"/.test(tag)) {
      const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
      if (href) found.add(href);
    }
  }
  // Only our own chunks count (there are no third-party scripts, and there must not be).
  return [...found].filter((src) => src.startsWith("/_next/")).sort();
}

const gzipCache = new Map<string, { bytes: number; source: string }>();

function chunk(src: string): { bytes: number; source: string } {
  const cached = gzipCache.get(src);
  if (cached) return cached;
  const file = join(STATIC_DIR, src.replace(/^\/_next\//, "").split("?")[0]!);
  const source = readFileSync(file);
  const result = { bytes: gzipSync(source, { level: 9 }).length, source: source.toString("utf8") };
  gzipCache.set(src, result);
  return result;
}

/**
 * Whether the scripts are only served to browsers that don't understand modules (the `noModule`
 * polyfill). Modern browsers skip them, so they don't count.
 */
function noModuleScripts(html: string): Set<string> {
  const found = new Set<string>();
  for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) {
    const src = /\bsrc="([^"]+)"/.exec(tag)?.[1];
    if (src && /\bnoModule\b/i.test(tag)) found.add(src);
  }
  return found;
}

export function measure(): PageSize[] {
  if (!existsSync(APP_DIR)) {
    throw new Error("No production build found. Run `pnpm build` first.");
  }
  return htmlFiles(APP_DIR)
    .map((file) => {
      const html = readFileSync(file, "utf8");
      const skipped = noModuleScripts(html);
      const scripts = scriptsIn(html).filter((src) => !skipped.has(src));
      const loaded = scripts.map(chunk);
      const heavy = HEAVY_MODULES.filter((heavyModule) =>
        loaded.some(({ source }) => source.includes(heavyModule.marker)),
      ).map((heavyModule) => heavyModule.name);
      return {
        route: routeOf(file),
        bytes: loaded.reduce((sum, { bytes }) => sum + bytes, 0),
        scripts,
        heavy,
      };
    })
    .filter((page) => !SKIP.has(page.route))
    .sort((a, b) => a.route.localeCompare(b.route));
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

function main() {
  const args = new Set(process.argv.slice(2));
  const pages = measure();

  if (args.has("--json")) {
    console.log(JSON.stringify(pages.map(({ route, bytes, heavy }) => ({ route, bytes, heavy }))));
    return;
  }

  const baseline: Record<string, number> = existsSync(BASELINE_FILE)
    ? (JSON.parse(readFileSync(BASELINE_FILE, "utf8")) as Record<string, number>)
    : {};

  if (args.has("--update")) {
    const next = Object.fromEntries(pages.map(({ route, bytes }) => [route, bytes]));
    writeFileSync(BASELINE_FILE, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Wrote ${relative(ROOT, BASELINE_FILE)} for ${pages.length} pages.`);
  }

  const problems: string[] = [];
  const rows = pages.map(({ route, bytes, heavy }) => {
    const before = baseline[route];
    const change =
      before === undefined ? "new" : `${bytes - before >= 0 ? "+" : ""}${kb(bytes - before)}`;
    if (bytes > INITIAL_JS_BUDGET_BYTES) {
      problems.push(
        `${route}: ${kb(bytes)} of initial JS is over the ${kb(INITIAL_JS_BUDGET_BYTES)} budget.`,
      );
    }
    if (!args.has("--update") && before !== undefined && bytes - before > TOLERANCE_BYTES) {
      problems.push(
        `${route}: grew from ${kb(before)} to ${kb(bytes)}. Split the new code out, or run \`pnpm bundle:check --update\` and commit the baseline with the reason.`,
      );
    }
    for (const name of heavy) {
      const heavyModule = HEAVY_MODULES.find((candidate) => candidate.name === name)!;
      if (!heavyModule.allowed.test(route)) {
        problems.push(
          `${route}: loads ${name} up front. Load it with next/dynamic where it's shown.`,
        );
      }
    }
    return `${route.padEnd(40)} ${kb(bytes).padStart(10)} ${change.padStart(10)}  ${heavy.join(", ")}`;
  });

  console.log(
    `${"Page".padEnd(40)} ${"Initial JS".padStart(10)} ${"vs base".padStart(10)}  Loads up front`,
  );
  console.log(rows.join("\n"));
  console.log(`\nBudget: ${kb(INITIAL_JS_BUDGET_BYTES)} gzipped per page.`);

  if (problems.length > 0) {
    console.error(
      `\n${problems.length} problem(s):\n${problems.map((line) => `- ${line}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log("Every page is within budget.");
}

if (require.main === module) main();
