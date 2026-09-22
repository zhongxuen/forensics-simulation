import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import { cx } from "@/lib/cx";
import { FIRST_STEP } from "@/lib/next-step";

/** The landing page: one line and one button (placeholder until file 06 writes its copy). */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-wrap items-center gap-3">
        <SimulatedBadge side="bottom" />
        <p className="text-sm text-secondary">Nothing here touches a real computer.</p>
      </div>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Candlewright: Incident Room
      </h1>
      <p className="text-lg leading-8 text-secondary">
        Join Candlewright Security&apos;s blue team and work out what happened after a break-in,
        from a disk, a memory dump and a set of logs. No experience needed.
      </p>
      <div className="space-y-3">
        <ButtonLink
          href={FIRST_STEP.href}
          variant="primary"
          size="lg"
          icon={<ArrowRightIcon />}
          className="flex-row-reverse"
        >
          {FIRST_STEP.title}
        </ButtonLink>
        <p className="text-base leading-7 text-secondary">
          No sign-up. Nothing to install.{" "}
          <Link
            href="/privacy"
            className={cx("rounded-sm text-accent underline underline-offset-4", FOCUS_RING)}
          >
            What we store
          </Link>
        </p>
      </div>
    </main>
  );
}
