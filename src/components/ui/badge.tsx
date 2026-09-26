import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * `reward` is for celebrations only: skills practised on the debrief, "Secret found!". Status
 * tones always carry a word ("Done", "Offline"), never colour alone.
 *
 * `evidence-tag` is for artefact refs (`disk:qf-lt-03:mft/1234`, `log:security/57`): an amber
 * outline in monospace, like the tag on an evidence bag. It's always monospace.
 */
export type BadgeTone =
  "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "reward" | "evidence-tag";

/**
 * `outline`: tinted text and border on whatever surface it sits on. `solid`: a filled chip for
 * stronger emphasis. Both use only audited colour pairs: tone text on a surface, or surface-base
 * text on a solid tone.
 */
export type BadgeAppearance = "outline" | "solid";

const OUTLINE: Readonly<Record<BadgeTone, string>> = {
  neutral: "border-strong text-secondary",
  accent: "border-accent text-accent",
  success: "border-status-success text-status-success",
  warning: "border-status-warning text-status-warning",
  danger: "border-status-danger text-status-danger",
  info: "border-status-info text-status-info",
  reward: "border-reward text-reward",
  "evidence-tag": "border-accent text-accent",
};

const SOLID: Readonly<Record<BadgeTone, string>> = {
  neutral: "border-strong bg-surface-overlay text-primary",
  accent: "border-accent bg-accent text-surface-base",
  success: "border-status-success bg-status-success text-surface-base",
  warning: "border-status-warning bg-status-warning text-surface-base",
  danger: "border-status-danger bg-status-danger text-surface-base",
  info: "border-status-info bg-status-info text-surface-base",
  reward: "border-reward bg-reward text-surface-base",
  // A filled amber chip would read as a button (UIUX.md §3.3), so the solid tag is the subtle fill.
  "evidence-tag": "border-accent bg-accent-subtle text-primary",
};

interface BadgeProps {
  tone?: BadgeTone;
  appearance?: BadgeAppearance;
  /** Shown before the text. Decorative: the text carries the meaning. */
  icon?: ReactNode;
  /** Monospace, for data-shaped labels such as a port or a skill id. */
  mono?: boolean;
  /**
   * Pops the badge once each time this changes (a tab's count going from 2 to 3). Leave it out
   * until something has changed, so a badge that loads with the page stays still.
   */
  popKey?: string | number;
  children: ReactNode;
  className?: string;
}

/** A short label: a skill, a status, a count. Display only. */
export function Badge({
  tone = "neutral",
  appearance = "outline",
  icon,
  mono = false,
  popKey,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      // A new key remounts the badge, which replays its pop.
      key={popKey}
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-sm leading-5 font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
        (mono || tone === "evidence-tag") && "font-mono text-xs leading-5",
        popKey !== undefined && "animate-badge-pop",
        appearance === "solid" ? SOLID[tone] : OUTLINE[tone],
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
