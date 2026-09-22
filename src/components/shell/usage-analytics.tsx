"use client";

import { lazy, Suspense } from "react";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Anonymous usage counts and Speed Insights (md-files/11-testing-security-deployment.md, prompt
 * 11.4; the scripts and the rules for when they load are in usage-analytics-scripts.tsx).
 *
 * This wrapper is all that's in a page's first download. The server can't know the browser's Do
 * Not Track setting, so nothing renders until the page has hydrated; then the rest arrives on its
 * own, off the critical path, and decides whether to load anything at all. Off Vercel (a laptop,
 * CI) there are no analytics endpoints, so it renders nothing (next.config.ts sets the flag).
 */
const UsageAnalyticsScripts = lazy(() => import("./usage-analytics-scripts"));

export function UsageAnalytics({
  enabled = process.env.NEXT_PUBLIC_USAGE_COUNTS === "on",
}: {
  /** Whether this deployment has Vercel's analytics endpoints. Tests pass it in. */
  enabled?: boolean;
}) {
  const hydrated = useHydrated();
  if (!enabled || !hydrated) return null;
  return (
    <Suspense fallback={null}>
      <UsageAnalyticsScripts />
    </Suspense>
  );
}
