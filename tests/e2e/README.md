# tests/e2e

Playwright end-to-end tests, run against a production build: `pnpm build`, then `pnpm test:e2e` (the config starts `pnpm start` on port 3217, or `E2E_PORT`; `E2E_BASE_URL` points it at a deployment instead). Chromium on a desktop, and a phone for the tests tagged `@mobile`. Install the browser once with `pnpm exec playwright install chromium`.

- `security.spec.ts` — security headers and the CSP on every route's real response, no CSP violation or console error while using the app, and nothing about the player left in the browser but the settings key. Vendored and adapted to these routes (`VENDORED.md`).
- `helpers.ts` — shared player steps (`run`, `prompt`, `skipTourIfShown`). Vendored; its mission helpers are unused until file 05 replaces them.

- `a11y.spec.ts` — axe on every route (zero serious or critical violations), the sandbox terminal with output and the open search palette, and the SIMULATED marker on every app page. Adapted from the sibling's spec in prompt 01.2; lessons are read from their folder, cases are listed by hand until file 03.

File 15 adds keyboard-only paths, the case workspace states and the case playthroughs.

Never import here: application internals. Drive the app through the browser the way a player would.
