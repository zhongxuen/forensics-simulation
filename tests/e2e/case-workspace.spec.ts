import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The case workspace's Evidence Browser (docs/plan/05-workspace-ui.md §Evidence Browser) on the
 * fixture case (the practice case, whose drive has one deleted file): open the drive from the
 * keyboard, find the deleted file, pin it with `p`, reload, and find the pin still there. axe runs
 * on the browser with a drive open, and the browser's code only arrives once its tab opens. The
 * Timeline's tests are at the end.
 */

const CASE = "/cases/practice";

async function startCase(page: Page) {
  await page.goto(CASE);
  await page.getByRole("button", { name: "Start case" }).click();
  await expect(page.getByRole("tab", { name: "Evidence" })).toBeVisible({ timeout: 20_000 });
}

/** Opens the Evidence tab, opens the drive from the keyboard, and lists its deleted records. */
async function openDeletedRecords(page: Page) {
  await page.getByRole("tab", { name: "Evidence" }).click();
  const drive = page.getByRole("treeitem", { name: /qf-lt-03/ });
  await expect(drive).toBeVisible({ timeout: 20_000 });
  await drive.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("treeitem", { name: /Windows \(partition 1\)/ })).toBeVisible();

  const deletedOnly = page.getByRole("checkbox", { name: "Deleted only" });
  await deletedOnly.focus();
  await page.keyboard.press("Space");
  await expect(deletedOnly).toBeChecked();
}

const deletedRow = (page: Page) =>
  page.getByRole("table").getByRole("row").filter({ hasText: "invoice-viewer.exe" });

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      where: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
    }));
}

test("finds a deleted file, pins it from the keyboard, and keeps the pin across a reload", async ({
  page,
}) => {
  await startCase(page);
  await openDeletedRecords(page);

  const row = deletedRow(page);
  await expect(row).toContainText("deleted");
  await row.focus();
  await page.keyboard.press("p");
  await expect(row).toContainText("pinned");
  await expect(row.getByRole("button", { name: "Unpin invoice-viewer.exe" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("tab", { name: "Board" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "Board" }).click();
  await expect(page.getByRole("article", { name: /invoice-viewer\.exe/ })).toBeVisible({
    timeout: 20_000,
  });

  await openDeletedRecords(page);
  await expect(deletedRow(page)).toContainText("pinned");
});

test("axe: the Evidence Browser with a drive open and a record's details showing", async ({
  page,
}) => {
  await startCase(page);
  await openDeletedRecords(page);
  await deletedRow(page).click();
  await expect(page.getByRole("button", { name: "Show in terminal" })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByRole("tab", { name: "Hex" }).click();
  await expect(page.getByRole("region", { name: "Hex view of invoice-viewer.exe" })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test("the Evidence Browser's code arrives only when its tab opens", async ({ page }) => {
  const scripts: string[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") scripts.push(response.url());
  });
  await startCase(page);
  await page.waitForLoadState("networkidle");
  const before = scripts.length;

  await page.getByRole("tab", { name: "Evidence" }).click();
  await expect(page.getByRole("tree", { name: "Evidence" })).toBeVisible({ timeout: 20_000 });
  expect(scripts.length).toBeGreaterThan(before);
});

test("Show in terminal puts the inode command at the prompt without running it", async ({
  page,
}) => {
  await startCase(page);
  await openDeletedRecords(page);
  await deletedRow(page).click();
  await page.getByRole("button", { name: "Show in terminal" }).click();
  const prompt = page.getByRole("textbox", { name: /^Command, in/ });
  await expect(prompt).toBeFocused();
  await expect(prompt).toHaveValue(/^inode \/dev\/evidence\/qf-lt-03 \d+$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("log", { name: "Terminal output" })).toContainText("Deleted     yes");
});

/**
 * The Timeline pane (docs/plan/09-timeline.md §The view): read the drive's times through its
 * write-blocker, step along the tracks from the keyboard, choose a moment, pin it with `p`, and
 * find it on the board. axe runs on the tracks with a moment chosen, and on the table view.
 */
async function openTimeline(page: Page) {
  await page.getByRole("tab", { name: "Timeline" }).click();
  await page.getByRole("button", { name: "Add qf-lt-03's file times" }).click({ timeout: 20_000 });
  const tracks = page.getByRole("application", { name: "Timeline tracks" });
  await expect(tracks).toBeVisible();
  return tracks;
}

test("the timeline: steps with the keyboard, pins a moment, and the board has it", async ({
  page,
}) => {
  await startCase(page);
  const tracks = await openTimeline(page);

  await tracks.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("+");
  await expect(page.getByText("Hours", { exact: true })).toBeVisible();
  await page.keyboard.press("Enter");

  const details = page.getByRole("region", { name: "The chosen moment" });
  await expect(details).toBeVisible();
  const ref = (await details.getByText(/^(disk|log|mem):/).textContent())!.trim();

  await page.keyboard.press("p");
  await expect(details.getByRole("button", { name: "Unpin from the case board" })).toBeVisible();

  await page.getByRole("tab", { name: "Board" }).click();
  await expect(page.getByRole("article").filter({ hasText: ref })).toBeVisible({
    timeout: 20_000,
  });
});

test("axe: the timeline's tracks with a moment chosen, and its table", async ({ page }) => {
  await startCase(page);
  const tracks = await openTimeline(page);
  await tracks.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "The chosen moment" })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

/**
 * Each pane lays itself out for the room it has (prompt UX.5): beside the terminal the Evidence
 * Browser drills in and the Timeline folds its filters; with Focus pane, the browser shows its
 * three columns and the Timeline puts its filters beside the tracks. axe runs on every pane in
 * both, with something open in each, and the board has a card to check.
 */
test("axe: every pane, beside the terminal and with Focus pane", async ({ page }) => {
  await startCase(page);
  await openDeletedRecords(page);
  const browser = page.locator("[data-layout]").first();
  await expect(browser).toHaveAttribute("data-layout", "drill-in");
  await expect(page.getByRole("navigation", { name: "Where you are in the drive" })).toBeVisible();
  await deletedRow(page).click();
  await expect(page.getByRole("button", { name: "Back to the records" })).toBeVisible();
  await page.getByRole("button", { name: "Pin to the case board" }).click();
  expect(await seriousViolations(page)).toEqual([]);

  const tracks = await openTimeline(page);
  await expect(page.locator('[data-layout="narrow"]')).toBeVisible();
  await tracks.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByRole("tab", { name: /^Board/ }).click();
  await expect(page.getByRole("article").first()).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByRole("button", { name: "Focus pane" }).click();
  await page.getByRole("tab", { name: "Evidence" }).click();
  await expect(page.locator('[data-layout="columns"]')).toBeVisible();
  await expect(page.getByRole("tree", { name: "Evidence" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.locator('[data-layout="wide"]')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByRole("tab", { name: /^Board/ }).click();
  expect(await seriousViolations(page)).toEqual([]);
});
