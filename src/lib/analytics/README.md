# src/lib/analytics

Anonymous, aggregate, cookieless usage counts, sent as Vercel Web Analytics custom events (phase 11; how to read each metric is in `md-files/metrics.md`).

- `events.ts` — the event types (`Mission started`, `Objective ticked`, `Mission completed`, `Hint opened`, `First tick`, `Error shown`), each a name and at most two properties: content ids, a hint tier, or a coarse bucket. Never anything a learner typed. Plus the pure helpers `firstTickBucket`, `entryKind`, `asksNotToTrack` and `stripQuery`.
- `index.ts` — `usageCountsAllowed()` (false on the server, under Do Not Track or Global Privacy Control, or with the `usageCounts` setting off), `trackUsage(event)` (never throws), `reportFirstTick()` (once per page load, the only state here), and `beforeSendUsage`, the `beforeSend` for Analytics and Speed Insights.

Which change to a mission run sends which event is `usageEventsBetween` in `@/features/missions`; the scripts load from `src/components/shell/usage-analytics.tsx`. Tested by `tests/unit/analytics.test.ts` and `tests/components/usage-analytics.test.tsx`.

Never import here: features or `src/app`. Never add a property that could carry learner text, an exact time, or anything that could single someone out, and never store anything.
