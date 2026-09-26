import { expect, test, type Locator, type Page } from "@playwright/test";
import { prompt } from "./helpers";
import { activate, horizontalOverflow, seriousViolations, showView, type } from "./keyboard";

/**
 * Case 1, "The clean copy", end to end from the landing page, **keyboard only**: nothing here
 * clicks (the steps are in keyboard.ts). It was the "Case 1 only" release's promise, and is the
 * first of the three (docs/plan/15-quality-and-launch.md §Quality checklist):
 * a visitor with no account lands, opens Case 1, copies the drive, proves the copy, pins the note,
 * and writes a report whose every answer is supported. On the way it submits once with an answer
 * that cites nothing, sees "Needs evidence", cites the pin and submits again
 * (docs/plan/10-case-board-report-custody.md).
 *
 * It runs twice: on a desktop, and on a 360 px phone, where the workspace shows one view at a time
 * with a tab bar along the bottom. axe checks every screen the case goes through on the way:
 * briefing, the workspace with each pane open (the Board and the chain of custody included), the
 * report and the debrief. After the commands, the current objective, the prompt and the tabs are
 * all on screen, and the page itself hasn't scrolled (UIUX.md §2.5).
 */

/** The workspace fits the screen: "Now", the prompt and the view tabs, with no page scroll. */
async function expectWorkspaceInView(page: Page) {
  await expect(page.getByRole("region", { name: "Now" })).toBeInViewport();
  await expect(prompt(page)).toBeInViewport();
  await expect(page.getByRole("tablist", { name: "Workspace views" })).toBeInViewport();
  const scroll = await page.evaluate(
    () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
  );
  expect(scroll).toBeLessThanOrEqual(1);
}

/** Ticks the pinned note's record in one answer's Supporting evidence, with the keyboard. */
async function cite(page: Page, picker: Locator) {
  const box = picker.getByRole("checkbox", { name: /the-door-was-open\.txt/ });
  await box.focus();
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
}

// A whole case with axe on every screen: more than the default minute on a busy machine.
test.setTimeout(180_000);

async function playCaseOne(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Every piece of evidence here is made up.")).toBeVisible();
  // The whole chapter is out (prompt 15B.1): three cases, and nothing still being written.
  await expect(page.getByText(/Three cases at one made-up haulage yard/)).toBeVisible();
  await expect(page.getByText(/still being written/)).toHaveCount(0);
  expect(await seriousViolations(page)).toEqual([]);

  await activate(page.getByRole("link", { name: "Open Case 1" }));
  await expect(page).toHaveURL(/\/cases\/case-01$/);
  await expect(page.getByRole("heading", { level: 1, name: "The clean copy" })).toBeVisible();
  // The cold open: two lines, each naming its speaker, before the first objective.
  await expect(page.getByText(/Idris Fenwick, investigations/)).toBeVisible();
  // The written permission is a signed letter, with what it covers and what it doesn't.
  const letter = page.getByRole("region", { name: "Your written permission" });
  await expect(letter.getByRole("list", { name: "You may examine" })).toContainText("qf-lt-03");
  await expect(letter.getByRole("list", { name: "Out of scope" })).toBeVisible();
  // Start case is on screen before the player has scrolled anywhere.
  await expect(page.getByRole("button", { name: "Start case" })).toBeInViewport();
  expect(await seriousViolations(page)).toEqual([]);

  // A phone opens the workspace on its Objectives tab, and `type` moves to the Terminal tab.
  await activate(page.getByRole("button", { name: "Start case" }));
  await expect(page.getByText("0 of 5 objectives done")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Now" })).toContainText(
    "Read the letter and the handover form",
  );

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
  await expectWorkspaceInView(page);
  // The Board counts its pin, and the Now strip says the report is next.
  await expect(page.getByRole("tab", { name: "Board", exact: true })).toContainText("1");
  await expect(page.getByRole("region", { name: "Now" })).toContainText(
    "Every main objective is done",
  );

  // Every pane, open, passes axe.
  await showView(page, "Evidence");
  await expect(page.getByRole("treeitem", { name: /qf-lt-03/ }).first()).toBeVisible({
    timeout: 20_000,
  });
  expect(await seriousViolations(page)).toEqual([]);
  await showView(page, "Timeline");
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible({ timeout: 20_000 });
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
  // Submit stays in reach at the foot of the screen, with how far through the report you are.
  const progress = page.getByRole("status").filter({ hasText: /answered/ });
  await expect(progress).toHaveText("0 of 3 answered, 0 with evidence");
  await expect(page.getByRole("button", { name: "Submit report" })).toBeInViewport();
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
  await expect(progress).toHaveText("3 of 3 answered, 2 with evidence");
  // Each pin is a card that says where it came from.
  await expect(
    pickers.nth(2).getByRole("checkbox", { name: /^Disk disk:qf-lt-03:.*the-door-was-open\.txt/ }),
  ).not.toBeChecked();
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
  // Each status is a word, never colour alone.
  await expect(page.getByText("Supported", { exact: true })).toHaveCount(3);
  // Hashed before anything opened the drive: the chain of custody's bonus.
  await expect(page.getByText("Fingerprint First:", { exact: false })).toBeVisible();
  await expect(page.getByText("Submitted the report: 3 of 3 findings supported.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download the custody record" })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  // Nothing on the debrief is wider than the screen, the phone's included.
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  // One next step: Case 2. Starting again waits in the "⋯ Case" menu, behind its confirm dialog.
  await expect(page.getByRole("button", { name: "Start the case again" })).toHaveCount(0);
  const menu = page.getByRole("button", { name: "Case", exact: true });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Start the case again" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await activate(page.getByRole("link", { name: "Next case: The deleted invoice" }));
  await expect(page).toHaveURL(/\/cases\/case-02$/);
  await expect(page.getByRole("heading", { level: 1, name: "The deleted invoice" })).toBeVisible();
}

test("Case 1 from the landing page to the debrief, keyboard only", async ({ page }) => {
  await playCaseOne(page);
});

test.describe("on a 360 px phone", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test("Case 1 can be finished, keyboard only", async ({ page }) => {
    await playCaseOne(page);
  });
});

test("/cases lists all three cases, in chapter order, and the practice case", async ({ page }) => {
  await page.goto("/cases");
  const main = page.getByRole("main");
  const titles = ["The clean copy", "The deleted invoice", "Something is still running"];
  // Each case is an article named by its title, with a button that says what happens (UX.2).
  for (const [index, title] of titles.entries()) {
    const card = main.getByRole("article", { name: title });
    await expect(card).toBeVisible();
    await expect(card.getByRole("link", { name: `Open Case ${index + 1}` })).toBeVisible();
  }
  await expect(
    main
      .getByRole("region", { name: "Practice" })
      .getByRole("link", { name: "Open the practice case" }),
  ).toBeVisible();
  const order = await main
    .getByRole("heading", { level: 3 })
    .evaluateAll(
      (headings, wanted) =>
        headings
          .map((heading) => wanted.findIndex((title) => heading.textContent?.includes(title)))
          .filter((index) => index !== -1),
      titles,
    );
  expect(order).toEqual([0, 1, 2]);
  expect(await seriousViolations(page)).toEqual([]);
});

test("Focus pane, the terminal drawer, the split handle and the Case menu, keyboard only", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/cases/case-01");
  await activate(page.getByRole("button", { name: "Start case" }));
  await expect(prompt(page)).toBeVisible({ timeout: 30_000 });
  await expectWorkspaceInView(page);

  // The handle between the terminal and the panes moves with the arrow keys.
  const handle = page.getByRole("separator", { name: "Resize the terminal and the case views" });
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "55");
  await page.keyboard.press("Enter");
  await expect(handle).toHaveAttribute("aria-valuenow", "50");

  // Focus pane: the pane gets the width, and the terminal waits in a drawer.
  const focus = page.getByRole("button", { name: "Focus pane" });
  await activate(focus);
  await expect(focus).toHaveAttribute("aria-pressed", "true");
  await expect(prompt(page)).toBeHidden();
  await expect(handle).toBeHidden();
  const opener = page.getByRole("button", { name: "Terminal", exact: true });
  await activate(opener);
  const drawer = page.getByRole("dialog", { name: "Terminal" });
  await expect(drawer).toBeVisible();
  await expect(prompt(page)).toBeFocused();
  // axe waits for animations to settle, and a focused prompt's cursor blinks for ever: check the
  // drawer with focus on its Close button, then go back to the prompt.
  await drawer.getByRole("button", { name: "Close the terminal" }).focus();
  expect(await seriousViolations(page)).toEqual([]);
  await prompt(page).focus();
  // A command typed in the drawer runs in the same terminal.
  await page.keyboard.type("blocker");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Command: blocker" })).toContainText("qf-lt-03");
  // Esc closes it, and focus goes back to the button that opened it.
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();
  await activate(focus);
  await expect(focus).toHaveAttribute("aria-pressed", "false");
  await expect(prompt(page)).toBeVisible();

  // Start the case again is in the "⋯ Case" menu, behind its confirm dialog.
  const menu = page.getByRole("button", { name: "Case", exact: true });
  await activate(menu);
  await expect(page.getByRole("menuitem", { name: "Start the case again" })).toBeFocused();
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("dialog", { name: "Start this case again?" });
  await expect(confirm).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await activate(confirm.getByRole("button", { name: "Keep going" }));
  await expect(confirm).toBeHidden();
  await expect(menu).toBeFocused();
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
