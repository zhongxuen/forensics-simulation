import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import {
  CHAPTER_LENGTH,
  DISCLAIMERS,
  HACKER_SIMULATION_URL,
  PITCH,
  SIMULATED_LINE,
  stillBeingWritten,
} from "@/content/release";
import { cx } from "@/lib/cx";
import { FIRST_STEP } from "@/lib/next-step";

const LINK = cx("rounded-sm text-accent underline underline-offset-4", FOCUS_RING);

/**
 * The landing page: what the game is in one sentence, that everything in it is made up, and one
 * button into the first case (wherever `src/content/cases/chapter.ts` says the chapter starts).
 * Under it, what the game leaves out, and which cases aren't out yet. The words live in
 * `src/content/release.ts`, where the voice rules check them.
 */
export default function HomePage() {
  const unreleased = stillBeingWritten();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-wrap items-center gap-3">
        <SimulatedBadge side="bottom" />
        <p className="text-sm text-secondary">{SIMULATED_LINE}</p>
      </div>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Candlewright: Incident Room
      </h1>
      <p className="text-lg leading-8 text-secondary">{PITCH}</p>
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
          {CHAPTER_LENGTH} No sign-up, nothing to install, and your work is saved in this browser
          only.{" "}
          <Link href="/privacy" className={LINK}>
            What we store
          </Link>
        </p>
      </div>
      <p className="text-base leading-7 text-secondary">
        Want the other side of the story? Play{" "}
        <a href={HACKER_SIMULATION_URL} className={LINK}>
          Candlewright&apos;s red team
        </a>{" "}
        in Hacker Simulation, set in the same world.
      </p>
      <section
        aria-labelledby="about-this-simulation"
        className="mt-4 border-t border-subtle pt-6 text-sm leading-6 text-secondary"
      >
        <h2 id="about-this-simulation" className="font-semibold text-primary">
          What this is, and isn&apos;t
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          {DISCLAIMERS.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {unreleased && <li>{unreleased}</li>}
        </ul>
      </section>
    </main>
  );
}
