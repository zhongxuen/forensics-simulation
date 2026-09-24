import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { prompt } from "./helpers";

/**
 * Case 1, "The clean copy", end to end from the landing page, **keyboard only**: nothing here
 * clicks. Focus moves with Tab, `focus()` on the thing a keyboard user would Tab to, and keys. It
 * is the "Case 1 only" release's promise (docs/plan/15-quality-and-launch.md §Quality checklist):
 * a visitor with no account lands, opens Case 1, copies the drive, proves the copy, pins the note,
 * and writes a report whose every answer is supported. On the way it submits once with an answer
 * that cites nothing, sees "Needs evidence", cites the pin and submits again
 * (docs/plan/10-case-board-report-custody.md).
 *
 * It runs twice: on a desktop, and on a 360 px phone, where the workspace shows one view at a time.
 * axe checks every screen the case goes through on the way: briefing, the workspace with each pane
 * open (the Board and the chain of custody included), the report and the debrief.
 */

async function seriousViolations(page: Page) {
  // A line that is still fading in would be measured at part opacity: wait for it to arrive.
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
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

/** Presses Enter on something a keyboard user has reached. */
async function activate(target: Locator) {
  await target.focus();
  await expect(target).toBeFocused();
  await target.press("Enter");
}

/** Types a command at the prompt with the keyboard, and waits for its output. */
async function type(page: Page, command: string): Promise<Locator> {
  await showView(page, "Terminal");
  const input = prompt(page);
  await input.focus();
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
  const block = page.getByRole("region", { name: `Command: ${command}` }).last();
  await expect(block).toBeVisible();
  return block;
}

/**
 * Shows a workspace view: a tab on the right on a desktop, or one of the tabs above everything on
 * a phone (where the terminal is a tab too). On a desktop the terminal is always showing.
 */
async function showView(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
  if ((await tab.count()) === 0) return;
  if ((await tab.getAttribute("aria-selected")) === "true") return;
  await activate(tab);
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

/** Ticks the pinned note's record in one answer's Supporting evidence, with the keyboard. */
async function cite(page: Page, picker: Locator) {
  const box = picker.getByRole("checkbox", { name: /the-door-was-open\.txt/ });
  await box.focus();
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
}

async function playCaseOne(page: Page) {
  await page.goto("/");
  await expect(page.getByText("SIMULATED: every piece of evidence is made up.")).toBeVisible();
  await expect(page.getByText("Cases 2 and 3 are still being written.")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await activate(page.getByRole("link", { name: "Open Case 1" }));
  await expect(page).toHaveURL(/\/cases\/case-01$/);
  await expect(page.getByRole("heading", { level: 1, name: "The clean copy" })).toBeVisible();
  // The cold open: two lines, each naming its speaker, before the first objective.
  await expect(page.getByText(/Idris Fenwick, investigations/)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  // A phone opens the workspace on its Objectives tab, and `type` moves to the Terminal tab.
  await activate(page.getByRole("button", { name: "Start case" }));
  await expect(page.getByText("0 of 5 objectives done")).toBeVisible({ timeout: 30_000 });

  // The paperwork, and the fingerprint the form was signed with.
  await type(page, "cat letter.txt");
  const form = await type(page, "cat handover.txt");
  const sha256 = /SHA-256:\s+([0-9a-f]{64})/.exec((await form.textContent()) ?? "")?.[1];
  expect(sha256, "the handover form carries a SHA-256").toBeDefined();

  // The copy, and the proof it is the same drive.
  await expect(await type(page, "blocker")).toContainText("qf-lt-03");
  await type(page, "acquire /dev/evidence/qf-lt-03 --out images/qf-lt-03.img");
  await expect(await type(page, `hashsum --verify ${sha256} images/qf-lt-03.img`)).toContainText(
    "MATCH",
  );

  // The note, its record, and the pin.
  await expect(
    await type(page, "lsfs images/qf-lt-03.img 'C:\\Users\\mara\\Desktop' -l"),
  ).toContainText("the-door-was-open.txt");
  await expect(await type(page, "inode images/qf-lt-03.img 46")).toContainText(
    "2026-04-11T19:44:37Z",
  );
  await expect(await type(page, "pin")).toContainText("pinned to the case board");

  // Every pane, open, passes axe.
  await showView(page, "Evidence");
  await expect(page.getByRole("treeitem", { name: /qf-lt-03/ }).first()).toBeVisible({
    timeout: 20_000,
  });
  expect(await seriousViolations(page)).toEqual([]);
  await showView(page, "Board");
  await expect(page.getByRole("article", { name: /the-door-was-open\.txt/ })).toBeVisible({
    timeout: 20_000,
  });
  expect(await seriousViolations(page)).toEqual([]);
  await showView(page, "Objectives");
  await expect(page.getByText("5 of 5 objectives done")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  // The chain of custody so far: the copy was checked before anything read from it.
  await activate(page.getByRole("tab", { name: "Chain of custody" }));
  const custody = page.getByRole("region", { name: "Chain of custody" });
  await expect(custody).toContainText("MATCH");
  expect(await seriousViolations(page)).toEqual([]);
  await activate(page.getByRole("tab", { name: "Checklist" }));

  // The report.
  await activate(page.getByRole("button", { name: "Write your report" }));
  await expect(
    page.getByRole("heading", { level: 1, name: /Your report for Quillfen/ }),
  ).toBeFocused();
  for (const choice of [
    "Yes — its SHA-256 is the SHA-256 on the handover form",
    "SHA-256, because that is the hash written on the handover form",
  ]) {
    const radio = page.getByRole("radio", { name: choice });
    await radio.focus();
    await page.keyboard.press("Space");
    await expect(radio).toBeChecked();
  }
  const when = page.getByRole("textbox", { name: /When was the note on the desktop created/ });
  await when.focus();
  await page.keyboard.type("2026-04-11T19:44:37Z");
  // Cite the pinned record for the first two answers, and leave the third citing nothing.
  const pickers = page.getByRole("group", { name: "Supporting evidence" });
  await expect(pickers).toHaveCount(3);
  for (const index of [0, 1]) await cite(page, pickers.nth(index));
  expect(await seriousViolations(page)).toEqual([]);

  await activate(page.getByRole("button", { name: "Submit report" }));
  await expect(
    page.getByRole("heading", { name: "Your report: 2 of 3 findings supported" }),
  ).toBeVisible();
  await expect(page.getByText("Needs evidence", { exact: true })).toBeVisible();
  await expect(
    page.getByText("That's right. Now show how you know: cite a pinned item that proves it."),
  ).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  // Back to the report, cite the pin for the third answer, and submit again.
  await activate(page.getByRole("button", { name: "Change your report" }));
  await expect(
    page.getByRole("heading", { level: 1, name: /Your report for Quillfen/ }),
  ).toBeFocused();
  await cite(page, page.getByRole("group", { name: "Supporting evidence" }).nth(2));
  await activate(page.getByRole("button", { name: "Submit report" }));
  await expect(
    page.getByRole("heading", { name: "Your report: 3 of 3 findings supported" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Case closed/ })).toBeFocused();
  // Hashed before anything opened the drive: the chain of custody's bonus.
  await expect(page.getByText("Fingerprint First:", { exact: false })).toBeVisible();
  await expect(page.getByText("Submitted the report: 3 of 3 findings supported.")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
}

test("Case 1 from the landing page to the debrief, keyboard only", async ({ page }) => {
  await playCaseOne(page);
});

test.describe("on a 360 px phone", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test("Case 1 can be finished, keyboard only", async ({ page }) => {
    await playCaseOne(page);
    // Nothing on the debrief is wider than the screen.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("/cases lists Case 1 and the practice case, not the cases still being written", async ({
  page,
}) => {
  await page.goto("/cases");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: /The clean copy/ })).toBeVisible();
  await expect(main.getByText("The deleted invoice")).toHaveCount(0);
  await expect(main.getByText("Something is still running")).toHaveCount(0);
  // Their pages stay, so a link or a save that points at one still lands somewhere.
  const response = await page.goto("/cases/case-02");
  expect(response?.status()).toBe(200);
});

test("reduced motion: Case 1 opens and plays with motion turned off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/cases/case-01");
  await activate(page.getByRole("button", { name: "Start case" }));
  await expect(prompt(page)).toBeAttached({ timeout: 30_000 });
  const moving = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === "running")
      .map((animation) => (animation as CSSAnimation).animationName ?? "transition"),
  );
  expect(moving).toEqual([]);
});
