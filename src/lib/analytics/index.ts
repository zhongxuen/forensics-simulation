import { track } from "@vercel/analytics";
import { getSettings } from "@/lib/settings";
import { asksNotToTrack, entryKind, firstTickBucket, stripQuery, type UsageEvent } from "./events";

/**
 * Anonymous, aggregate, cookieless usage counts, sent as Vercel Web Analytics custom events
 * (md-files/11-testing-security-deployment.md, prompt 11.4b; md-files/metrics.md). Nothing is sent
 * when the browser asks sites not to track it (Do Not Track or Global Privacy Control), or when the
 * learner turns off "Send anonymous usage counts" on /settings. Nothing is stored anywhere, in the
 * browser or on a server we run: the only memory is one in-memory flag per page load, so "First
 * tick" is sent once.
 */

export {
  asksNotToTrack,
  entryKind,
  FIRST_TICK_BUCKETS,
  firstTickBucket,
  stripQuery,
  type ErrorArea,
  type FirstTickBucket,
  type UsageEvent,
  type UsageEventName,
} from "./events";

/** Whether this browser, right now, may send usage counts. Read fresh every time. */
export function usageCountsAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (
    asksNotToTrack(
      navigator as Navigator & { globalPrivacyControl?: boolean },
      window as Window & { doNotTrack?: string },
    )
  ) {
    return false;
  }
  return getSettings().usageCounts;
}

/** Sends one usage event, if allowed. Never throws: counting must never get in a learner's way. */
export function trackUsage(event: UsageEvent): void {
  if (!usageCountsAllowed()) return;
  try {
    track(event.name, { ...event.props });
  } catch {
    // Analytics blocked or not loaded: nothing to do, and nothing to tell the learner.
  }
}

let firstTickSent = false;

/**
 * Sends "First tick" the first time any objective ticks after this page was opened: how long
 * since the page opened (bucketed) and whether the visit began on the landing page. Later ticks,
 * and ticks after a restart, don't send it again until the page is reloaded.
 */
export function reportFirstTick(): void {
  if (firstTickSent || typeof window === "undefined") return;
  firstTickSent = true;
  const [navigation] = performance.getEntriesByType("navigation");
  const entry = navigation ? new URL(navigation.name).pathname : window.location.pathname;
  trackUsage({
    name: "First tick",
    props: { entry: entryKind(entry), time: firstTickBucket(performance.now()) },
  });
}

/**
 * The `beforeSend` for Vercel Web Analytics and Speed Insights: drops everything when counts
 * aren't allowed, and strips query strings and fragments from page addresses otherwise.
 */
export function beforeSendUsage<T extends { url: string }>(event: T): T | null {
  return usageCountsAllowed() ? { ...event, url: stripQuery(event.url) } : null;
}
