"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { beforeSendUsage, usageCountsAllowed } from "@/lib/analytics";
import { useSettings } from "@/lib/settings";

/**
 * Vercel Web Analytics (page views and the usage counts in md-files/metrics.md) and Speed Insights
 * (how fast pages load for real learners), loaded by UsageAnalytics once the page has hydrated.
 * Both are cookieless and anonymous, and send nothing that identifies anyone.
 *
 * Neither script is even loaded when the browser asks sites not to track it, or when the learner
 * turned off "Send anonymous usage counts" on /settings. If they turn it off after the scripts
 * loaded, `beforeSendUsage` drops every event from then on, since it checks again each time. The
 * scripts are served from this site (/_vercel/...), so no third party is contacted.
 */
export default function UsageAnalyticsScripts() {
  // Re-renders when the setting changes; Do Not Track is read fresh each time.
  const { usageCounts } = useSettings();
  if (!usageCounts || !usageCountsAllowed()) return null;
  return (
    <>
      <Analytics beforeSend={beforeSendUsage} />
      <SpeedInsights beforeSend={beforeSendUsage} />
    </>
  );
}
