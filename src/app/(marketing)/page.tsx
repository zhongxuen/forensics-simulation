import Link from "next/link";
import { CHAPTER_ONE } from "@/content/cases/chapter";
import { ButtonLink } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import { cx } from "@/lib/cx";
import { FIRST_STEP } from "@/lib/next-step";

/**
 * The landing page: what the game is, what the first case is, and one button into it. The button
 * goes wherever `src/content/cases/chapter.ts` says the chapter starts.
 */
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
        You have joined Candlewright Security&apos;s blue team. A client asks what happened to one
        of their computers, and you find out: from a disk, a memory dump and a set of logs, in a
        simulated terminal and three investigator views. No experience needed.
      </p>
      <p className="text-base leading-7 text-secondary">{CHAPTER_ONE.opening}</p>
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
          Case 1 takes about 15 minutes. No sign-up, nothing to install, and your work is saved in
          this browser only.{" "}
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
