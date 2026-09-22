import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = {
  title: "Page not found – Candlewright: Incident Room",
};

/**
 * Any address that isn't a page (docs/plan/99-reference.md, "Voice": say what happened, why, and
 * what to try next, with no blame). Case pages are built ahead of time, so a mistyped case name
 * lands here too.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <SimulatedBadge side="bottom" />
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        There&apos;s no page at this address
      </h1>
      <div className="space-y-4 text-lg leading-8 text-secondary">
        <p>
          The address might have a typo in it, or the page may have moved. Nothing&apos;s broken,
          and it isn&apos;t something you did.
        </p>
        <p>Here are some good places to go instead.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={FIRST_STEP.href} variant="primary">
          {FIRST_STEP.title}
        </ButtonLink>
        <ButtonLink href="/cases" variant="secondary">
          See every case
        </ButtonLink>
        <ButtonLink href="/learn" variant="ghost">
          Browse the lessons
        </ButtonLink>
      </div>
    </main>
  );
}
