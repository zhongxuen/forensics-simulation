# tests/e2e

Playwright end-to-end tests, run against a production build: `pnpm build`, then `pnpm test:e2e` (the config starts `pnpm start` on port 3217, or `E2E_PORT`; `E2E_BASE_URL` points it at a deployment instead). Chromium on a desktop, and a phone for the tests tagged `@mobile`. Install the browser once with `pnpm exec playwright install chromium`.

- `security.spec.ts` — security headers and the CSP on every route's real response, no CSP violation or console error while using the app, and nothing about the player left in the browser but the settings key. Vendored and adapted to these routes (`VENDORED.md`).
- `helpers.ts` — shared player steps (`run`, `prompt`, `skipTourIfShown`). Vendored; its mission helpers are unused until file 05 replaces them.

- `a11y.spec.ts` — axe on every route (zero serious or critical violations), the sandbox terminal with output and the open search palette, and the SIMULATED marker on every app page. Adapted from the sibling's spec in prompt 01.2; lessons are read from their folder, cases are listed by hand until file 03.

- `case-workspace.spec.ts` — the Evidence Browser on the practice case: open a drive from the keyboard, pin a deleted file, keep the pin across a reload, axe with a drive open. And the Timeline: add the drive's times, step along the tracks from the keyboard, pin a moment with `p` and find it on the board, with axe on the tracks and the table.
- `timeline-performance.spec.ts` — frame times while stepping, zooming and brushing 5,000 moments on `/timeline-bench` (served only by the local server, `E2E_FIXTURES=1`). Adapted from Hacker Simulation's network-map spec; the numbers are in `src/features/timeline/README.md`.
- `case-01.spec.ts` — the "Case 1 only" release: Case 1 from the landing page to the debrief, **keyboard only** (nothing clicks), on a desktop and on a 360 px phone, with axe on the briefing, each workspace pane, the report and the debrief; `/cases` offering only released cases; and reduced motion leaving nothing moving.

Prompt 15B.1 adds keyboard-only playthroughs of Cases 2 and 3.

Never import here: application internals. Drive the app through the browser the way a player would.
