# tests/e2e

Playwright end-to-end tests, run against a production build: `pnpm build`, then `pnpm test:e2e` (the config starts `pnpm start` on port 3217, or `E2E_PORT`; `E2E_BASE_URL` points it at a deployment instead). Chromium on a desktop, and a phone for the tests tagged `@mobile`. Install the browser once with `pnpm exec playwright install chromium`.

- `security.spec.ts` — security headers and the CSP on every route's real response, no CSP violation or console error while using the app, and nothing about the player left in the browser but the settings key. Vendored and adapted to these routes (`VENDORED.md`).
- `helpers.ts` — shared player steps (`run`, `prompt`, `skipTourIfShown`). Vendored; its mission helpers are unused until file 05 replaces them.

Prompt 01.2 and file 15 add axe on every route, keyboard-only paths and the case playthroughs.

Never import here: application internals. Drive the app through the browser the way a player would.
