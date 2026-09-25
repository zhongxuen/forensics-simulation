import { readdirSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { run } from "./helpers";

/**
 * Accessibility on every route (docs/plan/00-overview.md §2, aim 5: axe on every route, zero
 * serious or critical violations), and the states a player spends time in: the sandbox terminal
 * with output, the search palette. Vendored from Hacker Simulation's a11y spec and adapted to
 * these routes (VENDORED.md). Lessons are read from their folder, so a new one is checked without
 * anyone remembering to add it; file 03 does the same for cases once they live in
 * src/content/cases. The case workspace states are in the case-01, case-02 and case-03 specs.
 *
 * The site has one colour theme, dark (src/styles/tokens.css: "the only theme in v1"). What a
 * player can change is the terminal's colours, so the sandbox terminal is checked in each of them.
 *
 * axe finds what a machine can: missing names, contrast, roles, structure. It can't say whether a
 * page makes sense with a screen reader; a person checks that (file 15).
 */

const LESSONS = readdirSync(join(process.cwd(), "src", "content", "lessons"))
  .filter((name) => name.endsWith(".mdx"))
  .map((name) => `/learn/${name.replace(/\.mdx$/, "")}`);

// Every chapter case has a page, released or not (src/content/cases/chapter.ts).
const CASES = ["/cases/case-01", "/cases/case-02", "/cases/case-03"];

const ROUTES = [
  "/",
  "/privacy",
  "/cases",
  ...CASES,
  "/sandbox",
  "/learn",
  "/learn/glossary",
  "/learn/commands",
  "/settings",
  "/this-page-does-not-exist",
  ...LESSONS,
];

/** The app's pages, which all carry the SIMULATED marker in the top bar. */
const APP_ROUTES = ROUTES.filter(
  (route) => !["/", "/privacy", "/this-page-does-not-exist"].includes(route),
);

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      where: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
    }));
}

test.describe.configure({ mode: "parallel" });

for (const route of ROUTES) {
  test(`axe: ${route} has no serious or critical violations`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test.describe("states the player spends time in", () => {
  test("axe: the sandbox terminal, with output", async ({ page }) => {
    await page.goto("/sandbox");
    await run(page, "ls");
    await run(page, "cat about.txt");
    await run(page, "mem psscan train-lt-03-mem");
    expect(await seriousViolations(page)).toEqual([]);
  });

  // The terminal colour themes in src/content/themes, by id (this folder never imports the app).
  for (const theme of ["candlewright", "phosphor", "amber", "deep-sea", "high-contrast"]) {
    test(`axe: the sandbox terminal in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((id) => {
        localStorage.setItem("incident-room:settings", JSON.stringify({ terminalTheme: id }));
      }, theme);
      await page.goto("/sandbox");
      await run(page, "logq --id 4625 --count-by IpAddress");
      // The default theme is the plain tokens, so it sets no attribute on <html>.
      const expected = theme === "candlewright" ? null : theme;
      expect(await page.locator("html").getAttribute("data-terminal-theme")).toBe(expected);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("axe: /cases and the sidebar with a case closed and one in progress", async ({ page }) => {
    await page.addInitScript(() => {
      const run = {
        phase: "workspace",
        log: [],
        pins: [],
        notes: "",
        reportDraft: {},
        completed: [],
        hintsShown: {},
        beatsPlayed: [],
        savedAt: 1,
      };
      const closed = {
        ...run,
        phase: "debrief",
        marks: [{ after: 0, kind: "submitted", supported: 3, total: 3 }],
      };
      localStorage.setItem(
        "incident-room:cases:v1",
        JSON.stringify({ v: 1, runs: { "case-01": closed, "case-02": run } }),
      );
    });
    await page.goto("/cases");
    await expect(page.getByText("Closed · 3 of 3 findings supported")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Read the debrief for Case 1", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue Case 2", exact: true })).toBeVisible();
    // The sidebar points back at the case in progress.
    await expect(page.locator("#app-sidebar").getByText(/Continue Case 2 · 0 of/)).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("inside a case the sidebar starts on the rail, and the saved setting is kept", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/cases/case-01");
    const sidebar = page.locator("#app-sidebar");
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(
      "The clean copy",
    );
    expect((await sidebar.boundingBox())?.width).toBeLessThan(100);
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBeGreaterThan(200);
    expect(await page.evaluate(() => localStorage.getItem("incident-room:settings"))).toBeNull();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("axe: the search palette, open", async ({ page }) => {
    await page.goto("/learn");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Search the app" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test.describe("the simulation framing", () => {
  for (const route of APP_ROUTES.filter((route) => !route.startsWith("/learn/"))) {
    test(`${route} shows the SIMULATED marker, and nothing can dismiss it`, async ({ page }) => {
      await page.goto(route);
      const marker = page.getByRole("banner").getByRole("button", { name: "Simulated" });
      await expect(marker).toBeVisible();
      await page.keyboard.press("Escape");
      await marker.click();
      await page.keyboard.press("Escape");
      await expect(marker).toBeVisible();
    });
  }

  test("the sandbox terminal carries its own SIMULATED marker", async ({ page }) => {
    await page.goto("/sandbox");
    await run(page, "ls");
    await expect(
      page.getByRole("region", { name: "Terminal" }).getByRole("button", { name: "Simulated" }),
    ).toBeVisible();
  });
});
