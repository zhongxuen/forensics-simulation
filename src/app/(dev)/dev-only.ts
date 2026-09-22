import { notFound } from "next/navigation";

/**
 * The gate on a developer-only page: served by `pnpm dev`, a 404 in every production build.
 *
 * The one exception is `E2E_FIXTURES=1`, which the Playwright config sets on the local server it
 * starts (playwright.config.ts). Some things can only be measured on a production build — the
 * frame rate of the network map, for one — and a page that only exists in `pnpm dev` can't be. The
 * variable is never set on a deployment, and the page it opens renders a made-up network and
 * nothing else: it reads no state and calls no route handler.
 *
 * Pages using this must also set `export const dynamic = "force-dynamic"`, so the check runs per
 * request rather than once at build time.
 */
export function requireDevPage(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.E2E_FIXTURES === "1") return;
  notFound();
}
