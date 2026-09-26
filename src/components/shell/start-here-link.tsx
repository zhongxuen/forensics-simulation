import Link from "next/link";
import { PlayIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { START_HERE_LABEL, type NextStep } from "@/lib/next-step";
import { FOCUS_RING, RAIL_TOOLTIP } from "./shell-styles";

interface StartHereLinkProps {
  step: NextStep;
  /**
   * `sidebar`: the card at the top of the sidebar; shrinks to a play button in the icon rail.
   * `bar`: a full-width card for the bar pinned to the bottom of small screens.
   * `inline`: an outlined button inside page content.
   */
  variant: "sidebar" | "bar" | "inline";
  /** The learner is on the step's own page. */
  current?: boolean;
  onNavigate?: () => void;
}

/** The amber play icon every variant leads with. */
function StepIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid shrink-0 place-items-center rounded-md border border-accent/40 bg-accent-subtle text-accent",
        className,
      )}
    >
      <PlayIcon className="size-4" />
    </span>
  );
}

/**
 * The next step: one click to the first case, or back to the case in progress ("Continue Case 1 ·
 * 1 of 5"), so a beginner never has to decide where to go. A raised card with an amber icon rather
 * than a filled slab (UIUX.md G2), so it never outshouts a page's own main button. The shell hides
 * it inside a case, where it would point at where you already are.
 */
export function StartHereLink({ step, variant, current = false, onNavigate }: StartHereLinkProps) {
  const label = step.label ?? START_HERE_LABEL;
  const shared = {
    href: step.href,
    onClick: onNavigate,
    "aria-current": current ? ("page" as const) : undefined,
  };

  if (variant === "bar") {
    return (
      <Link
        {...shared}
        className={cx(
          "flex items-center gap-3 rounded-lg border border-subtle bg-surface-raised px-3 py-2 hover:border-accent",
          FOCUS_RING,
        )}
      >
        <StepIcon className="size-8" />
        <span className="min-w-0">
          <span className="block type-eyebrow">{label}</span>
          <span className="block truncate leading-5 font-semibold text-primary">{step.title}</span>
        </span>
      </Link>
    );
  }

  if (variant === "inline") {
    return (
      <Link
        {...shared}
        className={cx(
          "inline-flex items-center gap-3 rounded-lg border border-accent py-2.5 pr-5 pl-2.5 hover:bg-accent-subtle",
          FOCUS_RING,
        )}
      >
        <StepIcon className="size-8" />
        <span>
          <span className="block leading-5 font-semibold">{label}</span>
          <span className="block text-sm leading-5 text-secondary">{step.title}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      {...shared}
      className={cx(
        "group relative flex items-center gap-3 rounded-lg border border-subtle bg-surface-overlay p-3 shadow-sm hover:border-accent",
        "rail:mx-auto rail:size-11 rail:justify-center rail:border-transparent rail:bg-transparent rail:p-0 rail:shadow-none",
        FOCUS_RING,
      )}
    >
      <StepIcon className="size-9" />
      <span className={cx("min-w-0", RAIL_TOOLTIP)}>
        <span className="block type-eyebrow">{label}</span>
        <span className="mt-0.5 block leading-5 font-semibold text-primary">{step.title}</span>
        <span className="mt-0.5 block text-xs leading-4 text-muted">{step.detail}</span>
      </span>
    </Link>
  );
}
