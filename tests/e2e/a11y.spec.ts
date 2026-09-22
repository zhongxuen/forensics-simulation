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
 * src/content/cases. File 15 adds the case workspace states.
 *
 * axe finds what a machine can: missing names, contrast, roles, structure. It can't say whether a
 * page makes sense with a screen reader; a person checks that (file 15).
 */

const LESSONS = readdirSync(join(process.cwd(), "src", "content", "lessons"))
  .filter((name) => name.endsWith(".mdx"))
  .map((name) => `/learn/${name.replace(/\.mdx$/, "")}`);

// The placeholder cases (src/app/(app)/cases/planned-cases.ts). File 03 reads them from the YAML.
const CASES = ["/cases/case-01", "/cases/case-02", "/cases/case-03"];

const ROUTES = [
  "/",
  "/privacy",
  "/cases",
  ...CASES,
  "/sandbox",
  "/learn",
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
    await run(page, "cat notes.txt");
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
