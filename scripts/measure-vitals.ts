/**
 * pnpm perf:vitals [--base http://localhost:3000] [--runs 3] [--no-throttle]
 *
 * Measures the Core Web Vitals budgets (docs/plan/15-quality-and-launch.md §Quality checklist) on
 * the three pages it names: LCP, CLS and INP, plus the JavaScript the page downloaded before it was
 * ready. Vendored from Hacker Simulation (VENDORED.md), with this game's pages. Run it against a production server (`pnpm build && pnpm start`), never
 * `pnpm dev`, which serves unminified code.
 *
 * By default it throttles like a mid-range phone on a slow mobile connection (Lighthouse's mobile
 * profile: 4x slower CPU, 150 ms round trips, 1.6 Mbps down), so a pass here is a pass for the
 * learners on the slowest devices we expect. `--no-throttle` measures a desktop.
 *
 * INP needs interactions, so each page gets a short script of the ones a learner does first:
 * moving focus with Tab, opening and closing the ⌘K palette, and on Case 1, pressing Start case
 * (the heaviest thing on the page: it builds the workspace and attaches the evidence). The worst
 * one is the INP.
 *
 * These are lab numbers from one machine. Real learners' numbers are in Vercel Speed Insights.
 */
import { chromium, type Page } from "@playwright/test";

interface Vitals {
  lcp: number;
  cls: number;
  inp: number;
  jsBytes: number;
}

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const BASE = option("--base") ?? "http://localhost:3000";
const RUNS = Number(option("--runs") ?? 3);
const THROTTLE = !args.includes("--no-throttle");

/** The interactions each page gets (the first thing a learner is likely to do there). */
const PAGES: readonly { route: string; interact: (page: Page) => Promise<void> }[] = [
  {
    route: "/",
    interact: async (page) => {
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.getByRole("heading", { level: 1 }).click();
    },
  },
  { route: "/cases", interact: paletteRoundTrip },
  {
    route: "/cases/case-01",
    interact: async (page) => {
      await paletteRoundTrip(page);
      await page.getByRole("button", { name: "Start case" }).click();
      await page.getByRole("textbox", { name: /command/i }).waitFor({ timeout: 30_000 });
    },
  },
];

async function paletteRoundTrip(page: Page) {
  await page.keyboard.press("Tab");
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
}

/** Installed before any page script runs: records LCP, CLS and every interaction's duration. */
const OBSERVERS = `
  window.__vitals = { lcp: 0, cls: 0, inp: 0 };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__vitals.lcp = entry.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__vitals.cls += entry.value;
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.interactionId) window.__vitals.inp = Math.max(window.__vitals.inp, entry.duration);
    }
  }).observe({ type: "event", buffered: true, durationThreshold: 16 });
`;

async function measureOnce(
  route: string,
  interact: (page: Page) => Promise<void>,
): Promise<Vitals> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(OBSERVERS);

  let jsBytes = 0;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  // The compressed bodies only: a response's headers (about 1 KB each, some 17 KB over the case
  // page's 15 chunks) are received before `responseReceived`, so they're taken off here. That
  // makes this the same set of bytes `pnpm bundle:check` counts, give or take the server's gzip
  // level (UIUX.md §2.9, O6).
  const scriptHeaders = new Map<string, number>();
  cdp.on("Network.responseReceived", (event) => {
    if (event.type === "Script") {
      scriptHeaders.set(event.requestId, event.response.encodedDataLength);
    }
  });
  cdp.on("Network.loadingFinished", (event) => {
    const headers = scriptHeaders.get(event.requestId);
    if (headers !== undefined) jsBytes += event.encodedDataLength - headers;
  });
  if (THROTTLE) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }

  // Initial JS is what arrived by the load event. After that, next/link prefetches the pages the
  // links point to while the browser is idle, which isn't this page's cost.
  await page.goto(`${BASE}${route}`, { waitUntil: "load" });
  const initialJs = jsBytes;
  await page.waitForLoadState("networkidle");
  await interact(page);
  await page.waitForTimeout(500);
  // LCP stops at the first input, so it's read after the interactions have finalised it.
  const vitals = (await page.evaluate(
    () => (window as unknown as { __vitals: Vitals }).__vitals,
  )) as Vitals;
  await browser.close();
  return { ...vitals, jsBytes: initialJs };
}

const median = (values: readonly number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

async function main() {
  console.log(
    `Measuring ${BASE} (${THROTTLE ? "mobile: 4x CPU, 150 ms, 1.6 Mbps" : "desktop, no throttling"}), median of ${RUNS} runs.\n`,
  );
  console.log(
    `${"Page".padEnd(20)} ${"LCP".padStart(9)} ${"INP".padStart(8)} ${"CLS".padStart(7)} ${"JS (gzip)".padStart(11)}`,
  );
  const results: Record<string, Vitals> = {};
  for (const { route, interact } of PAGES) {
    const runs: Vitals[] = [];
    for (let run = 0; run < RUNS; run += 1) runs.push(await measureOnce(route, interact));
    const result: Vitals = {
      lcp: median(runs.map((r) => r.lcp)),
      inp: median(runs.map((r) => r.inp)),
      cls: median(runs.map((r) => r.cls)),
      jsBytes: median(runs.map((r) => r.jsBytes)),
    };
    results[route] = result;
    console.log(
      `${route.padEnd(20)} ${`${Math.round(result.lcp)} ms`.padStart(9)} ${`${Math.round(result.inp)} ms`.padStart(8)} ${result.cls.toFixed(3).padStart(7)} ${`${(result.jsBytes / 1024).toFixed(1)} KB`.padStart(11)}`,
    );
  }
  console.log("\nBudgets: LCP < 2500 ms, INP < 200 ms, CLS < 0.1, initial JS < 200 KB gzipped.");
  if (args.includes("--json")) console.log(JSON.stringify(results));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
