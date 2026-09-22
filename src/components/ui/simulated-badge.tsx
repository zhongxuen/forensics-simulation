import { cx } from "@/lib/cx";
import { FOCUS_RING } from "./focus-ring";
import { InfoIcon } from "./icons";
import { Tooltip, type TooltipAlign, type TooltipSide } from "./tooltip";

export type SimulatedBadgeSize = "sm" | "md";

interface SimulatedBadgeProps {
  size?: SimulatedBadgeSize;
  side?: TooltipSide;
  align?: TooltipAlign;
  /** Force the explanation open or closed, for static previews. */
  open?: boolean;
  className?: string;
}

const SIZE_CLASSES: Readonly<Record<SimulatedBadgeSize, string>> = {
  sm: "h-6 gap-1 px-1.5 text-xs [&_svg]:size-3.5",
  md: "h-7 gap-1.5 px-2 text-sm [&_svg]:size-4",
};

export const SIMULATED_EXPLANATION =
  "Everything here is pretend. The computers, the network and the tools are part of a game running in your browser, so nothing you do reaches a real computer.";

/**
 * The "SIMULATED" marker every terminal, scanner and tool view carries (improvement #6 in
 * md-files/00-overview-and-improvements.md). It can't be dismissed. It's a button only so keyboard
 * and touch users can open its explanation; pressing it does nothing else.
 */
export function SimulatedBadge({ size = "md", side, align, open, className }: SimulatedBadgeProps) {
  return (
    <Tooltip
      content={SIMULATED_EXPLANATION}
      side={side}
      align={align}
      open={open}
      className={className}
    >
      <button
        type="button"
        className={cx(
          "inline-flex shrink-0 cursor-help items-center rounded-md border border-dashed border-status-warning font-mono font-semibold tracking-widest text-status-warning uppercase hover:bg-surface-overlay",
          SIZE_CLASSES[size],
          FOCUS_RING,
        )}
      >
        <InfoIcon />
        Simulated
      </button>
    </Tooltip>
  );
}
