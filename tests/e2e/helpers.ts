import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared steps for the end-to-end tests: the things a learner does, by what they see on screen
 * (roles, labels, words), never by the app's internals.
 */

/** The terminal's prompt. Its label says which folder you're in: "Command, in ~". */
export const prompt = (page: Page): Locator => page.getByRole("textbox", { name: /^Command, in/ });

/** Types a command at the prompt, presses Enter, and waits for its output block. */
export async function run(page: Page, command: string): Promise<Locator> {
  const input = prompt(page);
  await input.click();
  await input.fill(command);
  await input.press("Enter");
  const block = page.getByRole("region", { name: `Command: ${command}` }).last();
  await expect(block).toBeVisible();
  return block;
}

/** Closes the terminal tour if it's showing (missions with a guided tour open it on start). */
export async function skipTourIfShown(page: Page): Promise<void> {
  const skip = page.getByRole("button", { name: "Skip tour" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

/** Opens a mission and presses Start mission; resolves once the terminal is ready to type in. */
export async function startMission(page: Page, slug: string): Promise<void> {
  await page.goto(`/missions/${slug}`);
  await page.getByRole("button", { name: "Start mission" }).click();
  await expect(prompt(page)).toBeVisible({ timeout: 20_000 });
  await skipTourIfShown(page);
}

/** Mission copy marks code with backticks; on screen it's code font, so the name has none. */
export const onScreen = (text: string): string => text.replaceAll("`", "");

/**
 * Answers an objective: clicks the choice with this text, or types it into the answer box when
 * the objective takes free text.
 */
export async function answer(page: Page, text: string): Promise<void> {
  const choice = page.getByRole("button", { name: onScreen(text), exact: true });
  if ((await choice.count()) > 0) {
    await choice.first().click();
    return;
  }
  const box = page.getByRole("textbox", { name: "Your answer" }).first();
  await box.fill(text);
  await page.getByRole("button", { name: "Check my answer" }).first().click();
}

/** The objectives list beside the terminal. */
export const objectives = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Mission objectives" });
