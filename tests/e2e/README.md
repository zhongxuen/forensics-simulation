# tests/e2e

Playwright end-to-end tests, run against a production build: `pnpm build`, then `pnpm test:e2e` (the config starts `pnpm start` on port 3217, or `E2E_PORT`; `E2E_BASE_URL` points it at a deployment instead). Chromium on a desktop, and a phone for the tests tagged `@mobile`. Install the browser once with `pnpm exec playwright install chromium`.

- `security.spec.ts` — security headers and the CSP on every route's real response, no CSP violation or console error while using the app, and nothing about the player left in the browser but the settings key. Vendored and adapted to these routes (`VENDORED.md`).
- `helpers.ts` — shared player steps (`run`, `prompt`, `skipTourIfShown`). Vendored; its mission helpers are unused until file 05 replaces them.

- `a11y.spec.ts` — axe on every route (zero serious or critical violations), the sandbox terminal with output and the open search palette, and the SIMULATED marker on every app page. Adapted from the sibling's spec in prompt 01.2; lessons are read from their folder, cases are listed by hand until file 03.

- `case-workspace.spec.ts` — the Evidence Browser on the practice case: open a drive from the keyboard, pin a deleted file, keep the pin across a reload, axe with a drive open. And the Timeline: add the drive's times, step along the tracks from the keyboard, pin a moment with `p` and find it on the board, with axe on the tracks and the table.
- `timeline-performance.spec.ts` — frame times while stepping, zooming and brushing 5,000 moments on `/timeline-bench` (served only by the local server, `E2E_FIXTURES=1`). Adapted from Hacker Simulation's network-map spec; the numbers are in `src/features/timeline/README.md`.
- `case-01.spec.ts`, `case-02.spec.ts`, `case-03.spec.ts` — each case from the landing page or the case list to the debrief, **keyboard only** (nothing clicks; the shared steps are in `keyboard.ts`), on a desktop and on a 360 px phone, with axe on the briefing, each workspace pane, the report and the debrief. Cases 2 and 3 take their choice beats the wrong way first and check the cast's line on the debrief before picking again; Case 3 ends at the chapter's closing line. `case-01.spec.ts` also checks that `/cases` lists all three cases in chapter order, that reduced motion leaves nothing moving, and the first five minutes (prompt 06.2): the first objective ticks inside 2 minutes of landing, and the wrong turn (blocker off, MISMATCH) is undone by Reset machine.
- `visual.spec.ts` — screenshots (`toHaveScreenshot`, motion reduced) of `/`, `/cases`, and Case 1's briefing, each workspace view, report and debrief, at 1440 × 900 and 360 × 780 (UIUX.md, prompt UX.8). Baselines are per platform in `visual.spec.ts-snapshots/`; only Windows ones are committed, so it skips on Linux until someone records them (`docs/runbook.md` §9).
- `viewport.spec.ts` — after Case 1's first ten commands, the Now strip, the prompt and the tab bar are all in view with no page scroll, at both sizes. `keyboard.ts` holds those ten commands (`caseOneFirstTenCommands`).
- `a11y.spec.ts` also runs axe on the sandbox terminal in each of the five terminal colour themes.

Never import here: application internals. Drive the app through the browser the way a player would.
