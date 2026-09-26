import { expect, test } from "@playwright/test";
import { prompt } from "./helpers";
import { caseOneFirstTenCommands } from "./keyboard";

/**
 * UIUX.md §8, "Current objective, prompt and tabs in view": after the ten commands of Case 1's
 * playthrough, when the terminal holds the most output a first session builds up, the current
 * objective (the Now strip), the prompt and the workspace's tab bar are all inside the viewport,
 * and the page itself hasn't scrolled to get them there. On a desktop and on a 360 px phone.
 */

const SIZES = [
  { name: "1440 × 900", viewport: { width: 1440, height: 900 }, hasTouch: false },
  { name: "360 × 780", viewport: { width: 360, height: 780 }, hasTouch: true },
];

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: size.viewport, hasTouch: size.hasTouch });

    test("after ten commands, Now, the prompt and the tab bar are all in view", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.goto("/cases/case-01");
      await caseOneFirstTenCommands(page);

      const now = page.getByRole("region", { name: "Now" });
      await expect(now).toBeInViewport({ ratio: 1 });
      // The current objective is named in it: every main one is done, so it says the report is next.
      await expect(now).toContainText("Every main objective is done");
      await expect(prompt(page)).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("tablist", { name: "Workspace views" })).toBeInViewport({
        ratio: 1,
      });
      const scroll = await page.evaluate(() => ({
        top: window.scrollY,
        extra: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      }));
      expect(scroll.top).toBe(0);
      expect(scroll.extra).toBeLessThanOrEqual(1);
    });
  });
}
