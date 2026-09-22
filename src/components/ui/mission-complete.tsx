"use client";

import { useId, useRef, type CSSProperties, type ReactNode } from "react";
import { useSkippableEffects } from "@/hooks/use-skippable-effects";
import { cx } from "@/lib/cx";
import { Badge } from "./badge";
import { MedalIcon } from "./icons";

/** A skill the mission practised: its display name, and optionally its (decorative) icon. */
export type PractisedSkill = string | { readonly label: string; readonly icon?: ReactNode };

interface MissionCompleteProps {
  /** The mission's name, as the learner saw it in the briefing. */
  missionTitle: string;
  /** Skills the mission practised, by display name ("Linux", "Networking"). */
  skills: readonly PractisedSkill[];
  /** One optional extra line under the title. */
  children?: ReactNode;
  /** Use "h1" when this heads the debrief page. Defaults to "h2". */
  headingLevel?: "h1" | "h2";
  className?: string;
}

const SPARK_COUNT = 12;

/**
 * Where each spark in the burst flies: evenly spaced around the medal, alternating near and far,
 * with a small stagger. Worked out once, so every burst looks the same.
 */
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, index) => {
  const angle = (index / SPARK_COUNT) * 2 * Math.PI;
  const distance = index % 2 === 0 ? 76 : 52;
  return {
    key: index,
    reward: index % 3 !== 1,
    large: index % 2 === 0,
    style: {
      "--burst-x": `${Math.round(Math.cos(angle) * distance)}px`,
      "--burst-y": `${Math.round(Math.sin(angle) * distance)}px`,
      "--burst-delay": `${(index % 3) * 40}ms`,
    } as CSSProperties,
  };
});

/**
 * The celebration header at the top of a mission debrief: a medal, "Mission complete", the
 * mission's name, and the skills it practised.
 *
 * With full motion, the medal pops in with a burst of sparks, a scanline sweeps down, and the
 * heading glitches for a moment, all within 1.5s. Under reduced motion the medal, heading and
 * badges are simply there. Any key skips to the end, and nothing here takes focus or blocks
 * clicks. The heading can be focused from code (tabIndex -1), so a debrief page can move focus to
 * it.
 */
export function MissionComplete({
  missionTitle,
  skills,
  children,
  headingLevel = "h2",
  className,
}: MissionCompleteProps) {
  const Heading = headingLevel;
  const rootRef = useRef<HTMLElement>(null);
  const headingId = useId();
  useSkippableEffects(rootRef);

  return (
    <section
      ref={rootRef}
      aria-labelledby={headingId}
      className={cx(
        "relative isolate overflow-hidden rounded-xl border border-reward bg-surface-raised px-6 py-8 sm:px-8",
        className,
      )}
    >
      {/* Decoration only: the old-monitor texture and a scanline sweeping down once. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="fx-scanlines absolute inset-0" />
        <div className="absolute inset-0 animate-scanline-sweep bg-linear-to-b from-transparent via-reward-glow to-transparent opacity-0" />
      </div>

      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="relative grid size-20 shrink-0 place-items-center">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {SPARKS.map((spark) => (
              <span
                key={spark.key}
                style={spark.style}
                className={cx(
                  "fx-spark animate-burst rounded-full",
                  spark.reward ? "bg-reward" : "bg-accent",
                  spark.large ? "size-2" : "size-1.5",
                )}
              />
            ))}
          </div>
          <span
            aria-hidden="true"
            className="grid size-16 animate-pop place-items-center rounded-full bg-reward text-surface-base shadow-[0_0_28px_-4px_var(--reward-glow)]"
          >
            <MedalIcon className="size-9" strokeWidth={2} />
          </span>
        </div>

        <div className="min-w-0">
          <Heading
            id={headingId}
            tabIndex={-1}
            className="animate-glitch text-3xl font-semibold tracking-tight text-reward outline-none sm:text-4xl"
          >
            Mission complete
          </Heading>
          <p className="mt-1 text-lg leading-7 font-medium text-primary">{missionTitle}</p>
          {children && <div className="mt-2 leading-7 text-secondary">{children}</div>}

          {skills.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-secondary">Skills you practised</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {skills.map((skill) => {
                  const { label, icon } = typeof skill === "string" ? { label: skill } : skill;
                  return (
                    <li key={label}>
                      <Badge tone="reward" icon={icon}>
                        {label}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
