import { expect, test, type Page } from "@playwright/test";
import {
  activate,
  choose,
  cite,
  formSha256,
  horizontalOverflow,
  pickerFor,
  seriousViolations,
  showView,
  type,
  write,
} from "./keyboard";

/**
 * Case 2, "The deleted invoice", from the case list to the debrief, **keyboard only** (the steps
 * are in keyboard.ts), on a desktop and on a 360 px phone (docs/plan/15-quality-and-launch.md
 * §Quality checklist, "Keyboard-only: all three cases end to end").
 *
 * It follows the case's playthrough (src/content/cases/playthroughs/case-02.yaml): copy and verify
 * the laptop, list and pin the deleted invoices, recover two and carve the third, find the remote
 * sign-in, order the evening on the timeline, and follow the upload out through the firewall. The
 * report takes the owner's side on the choice beat first, sees Noor's explanation on the debrief
 * instead of a fail screen, changes the answer and closes the case with every finding supported.
 * axe checks the briefing, the workspace with each pane open, the report and both debriefs.
 */

test.setTimeout(240_000);

async function playCaseTwo(page: Page) {
  await page.goto("/cases");
  await activate(page.getByRole("main").getByRole("link", { name: "Open Case 2" }));
  await expect(page).toHaveURL(/\/cases\/case-02$/);
  await expect(page.getByRole("heading", { level: 1, name: "The deleted invoice" })).toBeVisible();
  await expect(page.getByText(/Theo Ashgrove, team lead\. The owner wants a name/)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await activate(page.getByRole("button", { name: "Start case" }));
  await expect(page.getByText(/0 of 6 objectives done/)).toBeVisible({ timeout: 30_000 });

  // The paperwork: the owner's times are British Summer Time, and the form has the fingerprint.
  await type(page, "cat letter.txt");
  await expect(await type(page, "cat door-log.txt")).toContainText("18:31");
  const sha256 = await formSha256(await type(page, "cat handover.txt"));

  // The copy, as in Case 1.
  await type(page, "acquire /dev/evidence/qf-lt-07 --out images/qf-lt-07.img");
  await expect(await type(page, `hashsum --verify ${sha256} images/qf-lt-07.img`)).toContainText(
    "MATCH",
  );

  // The deleted invoices, one pinned, two recovered, the third carved.
  await expect(await type(page, "lsfs images/qf-lt-07.img -r -d")).toContainText("inv-0410.pdf");
  await type(page, "inode images/qf-lt-07.img 48");
  await type(page, 'pin -m "invoice record, deleted Saturday"');
  await type(page, "recover images/qf-lt-07.img 48 --out export/inv-0407.pdf");
  await type(page, "recover images/qf-lt-07.img 52 --out export/inv-0409.pdf");
  await expect(await type(page, "carve images/qf-lt-07.img")).toContainText("partial");
  await expect(await type(page, "strings disk:qf-lt-07:carve/906")).toContainText("QF-INV-0410");
  await type(page, 'pin -m "carved statement start"');

  // The remote sign-in, and the bookkeeper's own sign-out at the door log's minute, in UTC.
  await type(page, "logq --id 4624 --where LogonType=10");
  await type(page, 'pin -m "remote sign-in from the office laptop"');
  await type(page, "logq --source security --from 2026-04-11T17:25Z --to 2026-04-11T17:35Z");
  await type(page, 'pin -m "bookkeeper sign-out at 17:31 UTC"');

  // The evening in one zone, and the way out.
  await type(page, "timeline --from 2026-04-11T20:30+01:00 --to 2026-04-11T20:50+01:00");
  await type(page, "logq --source firewall --where dst=203.0.113.80");
  await type(page, 'pin -m "upload out through the firewall"');

  // Every pane, open, passes axe.
  await showView(page, "Evidence");
  await expect(page.getByRole("treeitem", { name: /qf-lt-07/ }).first()).toBeVisible({
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

  // The report. The choice beat goes the owner's way first.
  await activate(page.getByRole("button", { name: "Write your report" }));
  await expect(
    page.getByRole("heading", { level: 1, name: /Your report for Quillfen/ }),
  ).toBeFocused();
  const remote = /remote sign-in from the office laptop/;

  await write(page, /Which account signed in/, "jory");
  await cite(page, pickerFor(page, /Which account signed in/), remote);
  await write(page, /Which machine did that sign-in come from/, "qf-lt-03");
  await cite(page, pickerFor(page, /Which machine did that sign-in come from/), remote);
  await choose(page, "Logon type 10: remote desktop, from another machine");
  await cite(page, pickerFor(page, /How did that sign-in happen/), remote);
  await write(page, /When were the invoices deleted/, "2026-04-11T19:42:03Z");
  await cite(page, pickerFor(page, /When were the invoices deleted/), /invoice record/);
  await choose(
    page,
    "No. The door log's 18:31 is 17:31 UTC, the minute their own session ended, more than two hours before the deletions",
  );
  await cite(page, pickerFor(page, /Was the bookkeeper at the yard/), /bookkeeper sign-out/);
  await write(page, /Where did the price lists go/, "203.0.113.80");
  await cite(page, pickerFor(page, /Where did the price lists go/), /upload out/);
  await choose(
    page,
    "Keep passwords out of shared folders, and lock screens that are left unattended",
  );
  await cite(page, pickerFor(page, /Which two changes/), remote);
  await choose(page, "That it was the bookkeeper, as the owner asked");
  await cite(page, pickerFor(page, /The owner's message asks/), remote);
  expect(await seriousViolations(page)).toEqual([]);

  await activate(page.getByRole("button", { name: "Submit report" }));
  await expect(
    page.getByRole("heading", { name: "Your report: 7 of 8 findings supported" }),
  ).toBeVisible();
  // No fail screen: Noor says why, and the choice is offered again.
  await expect(page.getByText(/A report that says what the client wants/)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await activate(page.getByRole("button", { name: "Change your report" }));
  await expect(
    page.getByRole("heading", { level: 1, name: /Your report for Quillfen/ }),
  ).toBeFocused();
  await choose(page, "What the evidence shows, whoever it points at");
  await activate(page.getByRole("button", { name: "Submit report" }));
  await expect(
    page.getByRole("heading", { name: "Your report: 8 of 8 findings supported" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Case closed/ })).toBeFocused();
  await expect(page.getByText(/A report that says what the client wants/)).toHaveCount(0);
  expect(await seriousViolations(page)).toEqual([]);
}

test("Case 2 from the case list to the debrief, keyboard only", async ({ page }) => {
  await playCaseTwo(page);
});

test.describe("on a 360 px phone", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test("Case 2 can be finished, keyboard only", async ({ page }) => {
    await playCaseTwo(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
