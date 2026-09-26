import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { CandleMark } from "@/components/ui/candle-mark";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SimulatedBadge } from "@/components/ui/simulated-badge";
import {
  CASE_ONE_STEPS,
  CHAPTER_LENGTH,
  DISCLAIMERS,
  EYEBROW,
  HACKER_SIMULATION_URL,
  PITCH,
  SIMULATED_LINE,
  START_NOTE,
  TITLE,
  stillBeingWritten,
} from "@/content/release";
import { cx } from "@/lib/cx";
import { FIRST_STEP } from "@/lib/next-step";
import { LoopStrip } from "./loop-strip";

const LINK = cx("rounded-sm text-accent underline underline-offset-4", FOCUS_RING);
const NAV_LINK = cx(
  "rounded-md px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-raised hover:text-primary",
  FOCUS_RING,
);

/**
 * The landing page (UIUX.md §2.2): the game in one sentence, one picture of its loop, and one
 * button into the first case (wherever `src/content/cases/chapter.ts` says the chapter starts).
 * Then what Case 1 asks of you in three steps, and what the game leaves out in a quieter block. A
 * small top bar reaches Learn and the sandbox without a second main button, and the SIMULATED
 * marker shows once. The words live in `src/content/release.ts`, where the voice rules check them.
 */
export default function HomePage() {
  const unreleased = stillBeingWritten();
  return (
    <>
      <header className="border-b border-subtle">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className={cx("flex items-center gap-2.5 rounded-md py-1 pr-2", FOCUS_RING)}
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-accent-subtle text-accent"
            >
              <CandleMark className="size-4.5" />
            </span>
            <span className="font-semibold tracking-tight">Candlewright: Incident Room</span>
          </Link>
          <nav aria-label="Main">
            <ul className="flex items-center gap-1">
              <li>
                <Link href="/learn" className={NAV_LINK}>
                  Learn
                </Link>
              </li>
              <li>
                <Link href="/sandbox" className={NAV_LINK}>
                  Sandbox
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
        <section aria-labelledby="landing-title" className="max-w-2xl">
          <p className="type-eyebrow text-accent">{EYEBROW}</p>
          <h1
            id="landing-title"
            className="mt-2 text-4xl font-semibold tracking-tight sm:type-display"
          >
            {TITLE}
          </h1>
          <p className="mt-6 text-lg leading-8 text-secondary">{PITCH}</p>
          <div className="mt-8 space-y-3">
            <ButtonLink
              href={FIRST_STEP.href}
              variant="primary"
              size="lg"
              icon={<ArrowRightIcon />}
              className="flex-row-reverse"
            >
              {FIRST_STEP.title}
            </ButtonLink>
            <p className="type-small text-secondary">
              {CHAPTER_LENGTH} {START_NOTE}{" "}
              <Link href="/privacy" className={LINK}>
                What we store
              </Link>
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <SimulatedBadge size="sm" side="bottom" />
            <p className="type-small text-secondary">{SIMULATED_LINE}</p>
          </div>
        </section>

        <section aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="type-section-title">
            How a case works
          </h2>
          <div className="mt-4">
            <LoopStrip />
          </div>
        </section>

        <section aria-labelledby="case-one">
          <h2 id="case-one" className="type-section-title">
            What you&apos;ll do in Case 1
          </h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {CASE_ONE_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-accent/40 bg-accent-subtle text-sm font-semibold text-accent"
                >
                  {index + 1}
                </span>
                <span>
                  <span className="block font-semibold text-primary">{step.title}</span>
                  <span className="mt-1 block type-small text-secondary">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <p className="max-w-2xl type-body text-secondary">
          Want the other side of the story? Play{" "}
          <a href={HACKER_SIMULATION_URL} className={LINK}>
            Candlewright&apos;s red team
          </a>{" "}
          in Hacker Simulation, set in the same world.
        </p>

        <section
          aria-labelledby="about-this-simulation"
          className="max-w-2xl rounded-xl border border-subtle p-5 type-small text-muted"
        >
          <h2 id="about-this-simulation" className="font-semibold text-secondary">
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
    </>
  );
}
