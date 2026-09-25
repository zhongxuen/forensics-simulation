import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { prompt } from "./helpers";

/**
 * The keyboard-only case playthroughs' shared steps (case-01, case-02 and case-03 specs): nothing
 * here clicks. Focus moves with `focus()` on the thing a keyboard user would Tab to, and keys.
 */

/** axe's serious and critical violations on the page as it is now, after any fade-in finishes. */
export async function seriousViolations(page: Page) {
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
export async function activate(target: Locator) {
  await target.focus();
  await expect(target).toBeFocused();
  await target.press("Enter");
}

/**
 * Shows a workspace view: a tab on the right on a desktop, or one of the tabs above everything on
 * a phone (where the terminal is a tab too). On a desktop the terminal is always showing.
 */
export async function showView(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
  if ((await tab.count()) === 0) return;
  if ((await tab.getAttribute("aria-selected")) === "true") return;
  await activate(tab);
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

/** Types a command at the prompt with the keyboard, and waits for its output. */
export async function type(page: Page, command: string): Promise<Locator> {
  await showView(page, "Terminal");
  const input = prompt(page);
  await input.focus();
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
  const block = page.getByRole("region", { name: `Command: ${command}` }).last();
  await expect(block).toBeVisible();
  return block;
}

/** Picks a report choice with the keyboard. */
export async function choose(page: Page, choice: string) {
  const radio = page.getByRole("radio", { name: choice, exact: true });
  await radio.focus();
  await page.keyboard.press("Space");
  await expect(radio).toBeChecked();
}

/** Types an answer into a report question's box, found by its question. */
export async function write(page: Page, question: RegExp, answer: string) {
  const box = page.getByRole("textbox", { name: question });
  await box.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.type(answer);
  await expect(box).toHaveValue(answer);
}

/**
 * Ticks a pin in one answer's Supporting evidence, with the keyboard. A pin's checkbox is named by
 * what it is, its ref and the note written with `pin -m`, so a note finds it.
 */
export async function cite(page: Page, picker: Locator, pin: RegExp) {
  const box = picker.getByRole("checkbox", { name: pin });
  await box.focus();
  if (!(await box.isChecked())) await page.keyboard.press("Space");
  await expect(box).toBeChecked();
}

/** The Supporting evidence picker under the report question that asks this. */
export function pickerFor(page: Page, question: RegExp): Locator {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByText(question) })
    .getByRole("group", { name: "Supporting evidence" });
}

/** The SHA-256 on the handover form, read from `cat handover.txt`'s output. */
export async function formSha256(block: Locator): Promise<string> {
  const sha256 = /SHA-256:\s+([0-9a-f]{64})/.exec((await block.textContent()) ?? "")?.[1];
  expect(sha256, "the handover form carries a SHA-256").toBeDefined();
  return sha256 ?? "";
}

/** Nothing on the page is wider than the screen. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
