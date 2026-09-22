import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (md-files/11-testing-security-deployment.md, prompt 11.1): one happy path per
 * module, the full net-01 playthrough, the first five minutes, accessibility (axe) on every route,
 * and the security headers on real responses.
 *
 * They run against a production build (`pnpm build`, then this starts `pnpm start`), never
 * `pnpm dev`: the security headers, the Content Security Policy without eval, and the code
 * splitting only exist in production. The port can be changed with E2E_PORT. With no API key the
 * mentor answers from its notes, which is what these tests expect; nothing here calls a model.
 *
 * E2E_BASE_URL runs the suite against a deployment instead (a smoke test after a deploy, see
 * md-files/deployment.md); no local server is started then.
 */
const PORT = Number(process.env.E2E_PORT ?? 3217);
const REMOTE = process.env.E2E_BASE_URL;
const BASE_URL = REMOTE ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }], ["list"]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: REMOTE
    ? undefined
    : {
        command: `pnpm start --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          // The mentor runs on its notes in these tests, whatever the shell has set.
          ANTHROPIC_API_KEY: "",
          MENTOR_DISABLED: "1",
          // Opens the developer-only measuring pages (src/app/(dev)/dev-only.ts) on this
          // production build, so the network map's frame rate can be measured at 200 hosts.
          // Never set on a deployment, so E2E_BASE_URL runs skip those tests.
          E2E_FIXTURES: "1",
        },
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // A phone, for the paths a first-time visitor on a phone takes.
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
});
