import { expect, test } from "@playwright/test";
import { run } from "./helpers";

/**
 * The app's own security and privacy, checked on the real production server
 * (md-files/11-testing-security-deployment.md, "Security review of this app"; prompt 11.2): the
 * headers on real responses, no Content Security Policy violation while a player uses the app, and
 * nothing about the player left in the browser, plus the mentor routes refusing other sites.
 * Vendored from Hacker Simulation and adapted to these routes (VENDORED.md).
 */

/** A well-formed hint body, so a refusal is never just a bad request. */
const HINT_BODY = {
  caseId: "case-01",
  objectiveId: "find-the-note",
  tier: 1,
  transcript: [],
};

const PAGES = ["/", "/cases", "/cases/case-01", "/sandbox", "/learn", "/settings", "/privacy"];

test.describe("security headers", () => {
  for (const path of PAGES) {
    test(`${path} is sent with the security headers and a CSP without eval`, async ({
      request,
    }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const headers = response.headers();
      const csp = headers["content-security-policy"] ?? "";
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).not.toContain("unsafe-eval");
      expect(headers["strict-transport-security"]).toContain("max-age=");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["permissions-policy"]).toContain("camera=()");
      expect(headers["x-powered-by"]).toBeUndefined();
      expect(headers["set-cookie"]).toBeUndefined();
    });
  }

  test("the mentor routes send them too, and never cache an answer", async ({ request }) => {
    const response = await request.post("/api/mentor/hint", { data: HINT_BODY });
    expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });
});

test.describe("the mentor routes", () => {
  test("refuse a request from another site, before any model call", async ({ request }) => {
    const response = await request.post("/api/mentor/hint", {
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      data: HINT_BODY,
    });
    expect(response.status()).toBe(403);
    expect(await response.text()).toContain('"reason":"cross_site"');
  });

  test("refuse a body that isn't JSON, and one that's too large", async ({ request }) => {
    const plain = await request.post("/api/mentor/hint", {
      headers: { "content-type": "text/plain" },
      data: JSON.stringify(HINT_BODY),
    });
    expect(plain.status()).toBe(415);
    const huge = await request.post("/api/mentor/hint", {
      data: { ...HINT_BODY, transcript: [{ input: "x", output: "y".repeat(40_000) }] },
    });
    expect(huge.status()).toBe(413);
  });

  test("answer GET with 405: there's nothing to read", async ({ request }) => {
    expect((await request.get("/api/mentor/hint")).status()).toBe(405);
  });

  test("answer with the authored text when there's no key, never an error", async ({ request }) => {
    // CI sets no ANTHROPIC_API_KEY, so this is the shipping default: a clean fallback, 200.
    const response = await request.post("/api/mentor/hint", { data: HINT_BODY });
    expect(response.status()).toBe(200);
    expect(response.headers()["x-mentor-mode"]).toBe("fallback");
    expect(await response.text()).toContain('"type":"fallback"');
  });
});

test("using the app breaks no Content Security Policy rule, and logs no errors", async ({
  page,
}) => {
  const problems: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { __csp: string[] }).__csp ??= [];
      (window as unknown as { __csp: string[] }).__csp.push(
        `${event.violatedDirective} blocked ${event.blockedURI}`,
      );
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  await page.goto("/");
  await page.getByRole("link", { name: "Open Case 1" }).click();
  await expect(page).toHaveURL(/\/cases\/case-01$/);
  await page.goto("/sandbox");
  await run(page, "ls");
  await run(page, "grep examiner logs/auth.log");

  const violations = await page.evaluate(
    () => (window as unknown as { __csp?: string[] }).__csp ?? [],
  );
  expect(violations).toEqual([]);
  expect(problems).toEqual([]);
});

test("using the sandbox leaves nothing about the player in the browser", async ({
  page,
  context,
}) => {
  await page.goto("/sandbox");
  await run(page, "cat notes.txt");
  await run(page, "ifconfig");
  await page.goto("/settings");
  await page.locator("label").filter({ hasText: "Keep the sidebar small" }).click();

  const stored = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    databases: (await indexedDB.databases()).map((database) => database.name),
    caches: await caches.keys(),
    settings: localStorage.getItem("incident-room:settings") ?? "",
  }));
  // Settings only: one key, holding display choices, and no command, file or address in it.
  expect(stored.local).toEqual(["incident-room:settings"]);
  expect(stored.settings).not.toMatch(/notes\.txt|ifconfig|examiner|10\.20\./);
  expect(stored.session).toEqual([]);
  expect(stored.databases).toEqual([]);
  expect(stored.caches).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});
