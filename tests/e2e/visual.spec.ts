import { existsSync, readdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  activate,
  caseOneFirstTenCommands,
  cite,
  choose,
  pickerFor,
  showView,
  write,
} from "./keyboard";

/**
 * Screenshots of the screens UIUX.md reworked (prompt UX.8): the landing page, the case list,
 * Case 1's briefing, its workspace with each view open, the report and the debrief, at 1440 × 900
 * and 360 × 780. Motion is reduced and animations are stopped, so each picture is the still state
 * a reduced-motion player sees, and the same on every run.
 *
 * A baseline is a picture of one operating system's fonts, so Playwright files it by platform
 * (`visual.spec.ts-snapshots/<name>-chromium-<platform>.png`). The committed ones were recorded on
 * Windows. On a platform with none (CI's Linux runner, for now) these tests skip rather than fail
 * on a missing picture; record that platform's with
 * `pnpm test:e2e tests/e2e/visual.spec.ts --update-snapshots` on it, review them, and commit.
 * After an intended change to one of these screens, update and review the same way.
 */

const SNAPSHOTS = `${__filename}-snapshots`;
const hasBaselines =
  existsSync(SNAPSHOTS) &&
  readdirSync(SNAPSHOTS).some((name) => name.endsWith(`-${process.platform}.png`));

const SIZES = [
  { id: "desktop", viewport: { width: 1440, height: 900 }, hasTouch: false },
  { id: "phone", viewport: { width: 360, height: 780 }, hasTouch: true },
];

/**
 * Waits for fades to finish and fonts to load, then compares the screen with its baseline. Only
 * the landing page is taken whole: in the app shell a whole-page picture draws the fixed sidebar
 * and the sticky action bars partway down, which no player ever sees, so those are taken as the
 * screen shows them.
 */
async function snap(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage,
    animations: "disabled",
    caret: "hide",
  });
}

test.beforeEach(({ page }, testInfo) => {
  // `--update-snapshots` records them; otherwise a platform with no pictures has nothing to compare.
  test.skip(
    !hasBaselines && !["all", "changed"].includes(testInfo.config.updateSnapshots),
    `No visual baselines for ${process.platform} yet (see this file's header).`,
  );
  return page.emulateMedia({ reducedMotion: "reduce" });
});

for (const size of SIZES) {
  test.describe(size.id, () => {
    test.use({ viewport: size.viewport, hasTouch: size.hasTouch });

    test("the landing page", async ({ page }) => {
      await page.goto("/");
      await snap(page, `${size.id}-landing`, true);
    });

    test("the case list", async ({ page }) => {
      await page.goto("/cases");
      await snap(page, `${size.id}-cases`);
    });

    test("Case 1: briefing, each workspace view, report and debrief", async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto("/cases/case-01");
      await expect(page.getByRole("button", { name: "Start case" })).toBeVisible();
      await snap(page, `${size.id}-case-01-briefing`);

      await caseOneFirstTenCommands(page);
      // A phone shows the terminal as a view of its own; a desktop always has it on the left.
      await showView(page, "Terminal");
      await snap(page, `${size.id}-case-01-workspace-terminal`);

      await showView(page, "Objectives");
      await expect(page.getByText("5 of 5 objectives done")).toBeVisible();
      await snap(page, `${size.id}-case-01-workspace-objectives`);

      await showView(page, "Evidence");
      await expect(page.getByRole("treeitem", { name: /qf-lt-03/ }).first()).toBeVisible({
        timeout: 20_000,
      });
      await snap(page, `${size.id}-case-01-workspace-evidence`);

      await showView(page, "Timeline");
      await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible({
        timeout: 20_000,
      });
      await snap(page, `${size.id}-case-01-workspace-timeline`);

      await showView(page, "Board");
      await expect(page.getByRole("article", { name: /the-door-was-open\.txt/ })).toBeVisible({
        timeout: 20_000,
      });
      await snap(page, `${size.id}-case-01-workspace-board`);

      // The report, filled in and every answer citing the pinned note.
      await showView(page, "Objectives");
      await activate(page.getByRole("button", { name: "Write your report" }));
      await expect(
        page.getByRole("heading", { level: 1, name: /Your report for Quillfen/ }),
      ).toBeFocused();
      await choose(page, "Yes — its SHA-256 is the SHA-256 on the handover form");
      await choose(page, "SHA-256, because that is the hash written on the handover form");
      await write(page, /When was the note on the desktop created/, "2026-04-11T19:44:37Z");
      for (const question of [/same as the drive/, /Which hash/, /When was the note/]) {
        await cite(page, pickerFor(page, question), /the-door-was-open\.txt/);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await snap(page, `${size.id}-case-01-report`);

      await activate(page.getByRole("button", { name: "Submit report" }));
      await expect(page.getByRole("heading", { level: 1, name: /Case closed/ })).toBeFocused();
      await expect(
        page.getByRole("heading", { name: "Your report: 3 of 3 findings supported" }),
      ).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await snap(page, `${size.id}-case-01-debrief`);
    });
  });
}
