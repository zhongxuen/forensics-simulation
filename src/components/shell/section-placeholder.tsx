import type { ReactNode } from "react";
import type { NextStep } from "@/lib/next-step";
import { StartHereLink } from "./start-here-link";

interface SectionPlaceholderProps {
  /** The page's main heading: what this place is for, in plain words. */
  headline: string;
  /** What the learner will do here, once it's built. */
  children: ReactNode;
  /** Shown instead of the default "still building" line. */
  status?: string;
  /** Where to send the learner meanwhile. Leave out on the first step's own page. */
  nextStep?: NextStep;
}

/** A page that isn't built yet: says what it will be, and points to where to start. */
export function SectionPlaceholder({
  headline,
  children,
  status = "We're still building this part of Incident Room. Check back soon.",
  nextStep,
}: SectionPlaceholderProps) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{headline}</h1>
      <div className="mt-4 space-y-4 text-lg leading-8 text-secondary">{children}</div>

      <div className="mt-10 rounded-lg border border-dashed border-strong p-6">
        <p className="leading-7 text-secondary">{status}</p>
        {nextStep && (
          <div className="mt-5">
            <StartHereLink step={nextStep} variant="inline" />
          </div>
        )}
      </div>
    </div>
  );
}
