import { expect, test, type Page } from "@playwright/test";
import {
  activate,
  choose,
  cite,
  horizontalOverflow,
  pickerFor,
  seriousViolations,
  showView,
  type,
  write,
} from "./keyboard";

/**
 * Case 3, "Something is still running", from the case list to the chapter's close, **keyboard
 * only** (the steps are in keyboard.ts), on a desktop and on a 360 px phone
 * (docs/plan/15-quality-and-launch.md §Quality checklist, "Keyboard-only: all three cases end to
 * end").
 *
 * It follows the case's playthrough (src/content/cases/playthroughs/case-03.yaml): open the memory
 * capture, find the process calling out, show it is hidden and misplaced, find the program in its
 * memory, trace the way in through the sign-in records, and put Sunday night on the timeline. The
 * report sides with Kit on both choice beats first — pull the plug, connect to the address — sees
 * Noor's explanations on the debrief, picks again, and closes the case and the chapter.
 */

test.setTimeout(240_000);

async function playCaseThree(page: Page) {
  await page.goto("/cases");
  await activate(page.getByRole("main").getByRole("link", { name: /Something is still running/ }));
  await expect(page).toHaveURL(/\/cases\/case-03$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Something is still running" }),
  ).toBeVisible();
  await expect(page.getByText(/Kit Nakashima-Reyes here/)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await activate(page.getByRole("button", { name: "Start case" }));
  await expect(page.getByText(/0 of 6 objectives done/)).toBeVisible({ timeout: 30_000 });

  // Memory first.
  await type(page, "cat letter.txt");
  await expect(await type(page, "mem info qf-srv-01-mem")).toContainText("qf-srv-01");

  // The process calling out, and why it doesn't belong.
  await expect(await type(page, "mem netscan qf-srv-01-mem")).toContainText("203.0.113.47");
  await type(page, 'pin -m "connection to 203.0.113.47"');
  await type(page, "mem ps qf-srv-01-mem");
  await expect(await type(page, "mem psscan qf-srv-01-mem")).toContainText("unlinked");
  await type(page, 'pin -m "hidden svchost in ProgramData"');
  await expect(await type(page, "mem malfind qf-srv-01-mem --pid 4376")).toContainText("MZ");
  await type(page, 'pin -m "program in memory, no file behind it"');

  // The way in.
  await expect(await type(page, "logq --id 4625 --count-by IpAddress")).toContainText("312");
  await type(page, "logq --id 4624 --where IpAddress=198.51.100.23");
  await type(page, 'pin -m "sign-in that worked"');
  await type(page, "logq --id 4720");
  await type(page, 'pin -m "account they added"');

  // Sunday night in one order, and the address on the firewall.
  await type(page, "timeline --from 2026-04-12T22:57Z --to 2026-04-12T23:10Z");
  await type(page, "logq --source firewall --where dst=203.0.113.47 --from 2026-04-14T09:30Z");
  await type(page, 'pin -m "address blocked at the firewall"');

  // Every pane, open, passes axe: the Evidence Browser's processes, the timeline, the board.
  await showView(page, "Evidence");
  // No drive was handed over, so the Evidence Browser opens on the capture's processes.
  await expect(page.getByRole("table", { name: /Processes in qf-srv-01-mem/ })).toBeVisible({
    timeout: 20_000,
  });
  expect(await seriousViolations(page)).toEqual([]);
  await showView(page, "Timeline");
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible({ timeout: 20_000 });
  expect(await seriousViolations(page)).toEqual([]);
  await showView(page, "Board");
  await expect(page.getByRole("article").first()).toBeVisible({ timeout: 20_000 });
  expect(await seriousViolations(page)).toEqual([]);
  await showView(page, "Objectives");
  await expect(page.getByText(/6 of 6 objectives done/)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  // The report. Both choice beats go Kit's way first.
  await activate(page.getByRole("button", { name: "Write your report" }));
  await expect(
    page.getByRole("heading", { level: 1, name: /Your report for Quillfen/ }),
  ).toBeFocused();
  const signIn = /sign-in that worked/;
  const beacon = /hidden svchost in ProgramData/;

  await choose(page, "Hundreds of guessed passwords over remote desktop, then one that worked");
  await cite(page, pickerFor(page, /How did they get in/), signIn);
  await write(page, /Which account did they sign in with/, "dispatch-admin");
  await cite(page, pickerFor(page, /Which account did they sign in with/), signIn);
  await write(page, /Which account did they add/, "svc-update");
  await cite(page, pickerFor(page, /Which account did they add/), /account they added/);
  const pick = page.getByRole("combobox", { name: /Which process is the problem/ });
  await pick.focus();
  // A native select: the keyboard picks an option by moving to it, which selectOption does.
  await pick.selectOption("mem:qf-srv-01-mem:pid/4376");
  await expect(pick).toHaveValue("mem:qf-srv-01-mem:pid/4376");
  await choose(
    page,
    "Its folder, its parent, its hiding from the active list, and the program in its memory with no file behind it",
  );
  await cite(page, pickerFor(page, /What gives it away/), beacon);
  await write(page, /Which address does it talk to/, "203.0.113.47");
  await cite(page, pickerFor(page, /Which address does it talk to/), /connection to 203/);
  await choose(
    page,
    "Close remote desktop to the internet, reset passwords and turn on a second sign-in step, remove svc-update, block the address and rebuild the server from a known-good image",
  );
  await cite(page, pickerFor(page, /What should the yard do now/), signIn);
  await choose(page, "Pull the plug at once, to stop it");
  await cite(page, pickerFor(page, /Which was the right call/), beacon);
  await choose(page, "Connect to it, to see who answers");
  await cite(page, pickerFor(page, /What goes in your report/), /address blocked/);
  expect(await seriousViolations(page)).toEqual([]);

  await activate(page.getByRole("button", { name: "Submit report" }));
  await expect(
    page.getByRole("heading", { name: "Your report: 7 of 9 findings supported" }),
  ).toBeVisible();
  // No fail screen: Noor says why, twice, and both choices are offered again.
  await expect(page.getByText(/Pull the plug and the running programs/)).toBeVisible();
  await expect(page.getByText(/Connecting tells whoever is there/)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await activate(page.getByRole("button", { name: "Change your report" }));
  await expect(
    page.getByRole("heading", { level: 1, name: /Your report for Quillfen/ }),
  ).toBeFocused();
  await choose(page, "Capture memory first, then contain it");
  await choose(page, "Block the address at the firewall and write it in the report");
  await activate(page.getByRole("button", { name: "Submit report" }));
  await expect(
    page.getByRole("heading", { name: "Your report: 9 of 9 findings supported" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Case closed/ })).toBeFocused();

  // The last case closes the chapter, and points at the other side of the story.
  await expect(page.getByRole("heading", { name: "What happened at Quillfen" })).toBeVisible();
  await expect(page.getByText(/Nobody broke in at Quillfen/).first()).toBeVisible();
  const next = page.getByRole("link", { name: /Play Chapter 2 of Hacker Simulation/ });
  await expect(next).toHaveAttribute("href", /hacker-simulation.*#chapter-the-handover$/);
  await expect(next).toHaveAttribute("target", "_blank");
  expect(await seriousViolations(page)).toEqual([]);
}

test("Case 3 from the case list to the chapter's close, keyboard only", async ({ page }) => {
  await playCaseThree(page);
});

test.describe("on a 360 px phone", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test("Case 3 can be finished, keyboard only", async ({ page }) => {
    await playCaseThree(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
