/**
 * The anonymous usage counts (md-files/11-testing-security-deployment.md, "Engagement & learning
 * metrics", and md-files/metrics.md for how each one is read). Every event is a name and at most
 * two short properties, all of them ids from the content or a coarse bucket: never a command, an
 * answer, a note, a time of day, or anything else a learner typed or could be recognised by.
 *
 * There are no ids for people, sessions or devices, and no cookies: Vercel Web Analytics counts
 * events, and these are only ever read as totals.
 */

export type UsageEvent =
  /** A learner pressed Start mission. Completion rate = completed / started. */
  | { readonly name: "Mission started"; readonly props: { readonly mission: string } }
  /** An objective ticked. Drop-off by objective = how many tick each step, in mission order. */
  | {
      readonly name: "Objective ticked";
      readonly props: { readonly mission: string; readonly objective: string };
    }
  /** Every main objective ticked. */
  | { readonly name: "Mission completed"; readonly props: { readonly mission: string } }
  /** A hint tier was shown. Tier-3 rate per objective = tier 3 opens / starts of the mission. */
  | {
      readonly name: "Hint opened";
      readonly props: { readonly step: string; readonly tier: 1 | 2 | 3 };
    }
  /**
   * The first objective ticked since this page was opened, and roughly how long after. `entry`
   * says whether the visit began on the landing page, so "landing to first tick" can be read on
   * its own. Sent once per page load.
   */
  | {
      readonly name: "First tick";
      readonly props: { readonly entry: "home" | "other"; readonly time: FirstTickBucket };
    }
  /**
   * An error screen was shown (error tracking, prompt 11.4): which part of the app, and the error's
   * digest (a hash Next.js gives server errors, to find the matching line in Vercel's logs; "none"
   * for errors that happened in the browser). Never the error's message.
   */
  | {
      readonly name: "Error shown";
      readonly props: { readonly area: ErrorArea; readonly digest: string };
    };

/** Which error boundary caught it: the app's pages, the public pages, or the whole document. */
export type ErrorArea = "app" | "site" | "page";

export type UsageEventName = UsageEvent["name"];

/**
 * Coarse time buckets, so a count per bucket shows the spread (the median is the bucket where
 * the running total passes half) without sending an exact duration.
 */
export const FIRST_TICK_BUCKETS = [
  "under 30s",
  "30s-1m",
  "1-2m",
  "2-3m",
  "3-5m",
  "5-10m",
  "over 10m",
] as const;

export type FirstTickBucket = (typeof FIRST_TICK_BUCKETS)[number];

/** Which bucket a duration (milliseconds since the page was opened) falls in. */
export function firstTickBucket(ms: number): FirstTickBucket {
  const seconds = ms / 1000;
  if (seconds < 30) return "under 30s";
  if (seconds < 60) return "30s-1m";
  if (seconds < 120) return "1-2m";
  if (seconds < 180) return "2-3m";
  if (seconds < 300) return "3-5m";
  if (seconds < 600) return "5-10m";
  return "over 10m";
}

/** "home" when the visit's first page was the landing page, else "other". */
export function entryKind(pathname: string): "home" | "other" {
  return pathname === "/" || pathname === "" ? "home" : "other";
}

/**
 * Whether the browser asks sites not to track it: Do Not Track, or Global Privacy Control. Either
 * one means nothing is sent, whatever the setting says.
 */
export function asksNotToTrack(
  nav: { readonly doNotTrack?: string | null; readonly globalPrivacyControl?: boolean } | undefined,
  win?: { readonly doNotTrack?: string | null },
): boolean {
  return nav?.doNotTrack === "1" || nav?.globalPrivacyControl === true || win?.doNotTrack === "1";
}

/** A page address with any query string or fragment removed, so nothing extra rides along. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}
