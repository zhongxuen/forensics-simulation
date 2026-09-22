import Link from "next/link";
import { PlayIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import type { NextStep } from "@/lib/next-step";
import { FOCUS_RING, RAIL_TOOLTIP } from "./shell-styles";

interface StartHereLinkProps {
  step: NextStep;
  /**
   * `sidebar`: the card at the top of the sidebar; shrinks to a play button in the icon rail.
   * `bar`: a full-width button for the bar pinned to the bottom of small screens.
   * `inline`: an outlined button inside page content.
   */
  variant: "sidebar" | "bar" | "inline";
  /** The learner is on the step's own page. */
  current?: boolean;
  onNavigate?: () => void;
}

const LABEL = "Start here";

/**
 * The "Start here" entry point: one click to the first mission, so a beginner never has to decide
 * where to go. It's the one accent-filled control in the shell.
 */
export function StartHereLink({ step, variant, current = false, onNavigate }: StartHereLinkProps) {
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
          "flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-surface-base hover:bg-accent-hover",
          FOCUS_RING,
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-base text-accent">
          <PlayIcon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block leading-5 font-semibold">{LABEL}</span>
          <span className="block truncate text-sm leading-5 font-medium">{step.title}</span>
        </span>
      </Link>
    );
  }

  // Outlined, so the sidebar card stays the one filled Start here on screen.
  if (variant === "inline") {
    return (
      <Link
        {...shared}
        className={cx(
          "inline-flex items-center gap-3 rounded-lg border border-accent py-2.5 pr-5 pl-2.5 hover:bg-accent-subtle",
          FOCUS_RING,
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-surface-base">
          <PlayIcon className="size-4" />
        </span>
        <span>
          <span className="block leading-5 font-semibold">{LABEL}</span>
          <span className="block text-sm leading-5 text-secondary">{step.title}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      {...shared}
      className={cx(
        "group relative flex items-center gap-3 rounded-lg bg-accent p-3 text-surface-base shadow-[0_10px_28px_-14px_var(--accent)] hover:bg-accent-hover",
        "rail:mx-auto rail:size-11 rail:justify-center rail:p-0",
        FOCUS_RING,
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-base text-accent rail:bg-transparent rail:text-surface-base">
        <PlayIcon className="size-4.5" />
      </span>
      <span className={cx("min-w-0", RAIL_TOOLTIP)}>
        <span className="block leading-5 font-semibold">{LABEL}</span>
        <span className="block text-sm leading-5 font-medium">{step.title}</span>
        <span className="mt-0.5 block text-xs leading-4 rail:text-muted">{step.detail}</span>
      </span>
    </Link>
  );
}
