"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import type { ErrorArea } from "@/lib/analytics";
import { FIRST_STEP } from "@/lib/next-step";

interface ErrorStateProps {
  error: Error & { digest?: string };
  /** Tries the page again (Next.js re-fetches and re-renders the part that failed). */
  retry: () => void;
  area: ErrorArea;
}

/**
 * What a learner sees when a page breaks (md-files/voice-and-tone.md: "Something went wrong on our
 * end, not yours."). It says what happened without blame, what it means for a case in progress,
 * and offers two ways on: try again, or go somewhere that works.
 *
 * Error tracking without collecting anything personal (md-files/11-testing-security-deployment.md,
 * prompt 11.4): it counts that an error screen was shown, and the error's digest, the hash Next.js
 * gives a server error so it can be matched to Vercel's logs. The message never leaves the page.
 */
export function ErrorState({ error, retry, area }: ErrorStateProps) {
  // Loaded only when an error actually shows, so every page's first download stays small.
  useEffect(() => {
    import("@/lib/analytics")
      .then(({ trackUsage }) =>
        trackUsage({ name: "Error shown", props: { area, digest: error.digest ?? "none" } }),
      )
      .catch(() => {});
  }, [area, error.digest]);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Something went wrong on our end, not yours
      </h1>
      <div className="mt-4 space-y-4 text-lg leading-8 text-secondary">
        <p>
          This page ran into a problem it couldn&apos;t get past. Try it again, or reload the page.
        </p>
        <p>
          If you were working on a case, open it again from the case list. Everything you learned is
          still yours.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="primary" onClick={retry}>
          Try again
        </Button>
        <ButtonLink href={FIRST_STEP.href} variant="secondary">
          {FIRST_STEP.title}
        </ButtonLink>
        <ButtonLink href="/" variant="ghost">
          Go to the home page
        </ButtonLink>
      </div>
      {error.digest && (
        <p className="mt-8 text-sm text-muted">
          If it keeps happening, this code helps us find it:{" "}
          <code className="font-mono text-secondary">{error.digest}</code>
        </p>
      )}
    </div>
  );
}
