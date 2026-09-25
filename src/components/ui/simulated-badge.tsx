import { cx } from "@/lib/cx";
import { FOCUS_RING } from "./focus-ring";
import { InfoIcon } from "./icons";
import { Tooltip, type TooltipAlign, type TooltipSide } from "./tooltip";

/** `compact` fits a header or top bar; `sm` a tight toolbar; `md` a panel or page header. */
export type SimulatedBadgeSize = "compact" | "sm" | "md";

/**
 * `tape`: a dashed warning-orange outline, like tape across a doorway. Warning orange is always an
 * outline here, never a fill, so it can't be mistaken for an amber button (UIUX.md §3.3). It's the
 * only look today; the union leaves room for another without changing callers.
 */
export type SimulatedBadgeLook = "tape";

interface SimulatedBadgeProps {
  size?: SimulatedBadgeSize;
  look?: SimulatedBadgeLook;
  side?: TooltipSide;
  align?: TooltipAlign;
  /** Force the explanation open or closed, for static previews. */
  open?: boolean;
  className?: string;
}

const SIZE_CLASSES: Readonly<Record<SimulatedBadgeSize, string>> = {
  compact: "h-5 gap-1 px-1 text-xs leading-4 tracking-wider [&_svg]:size-3",
  sm: "h-6 gap-1 px-1.5 text-xs tracking-widest [&_svg]:size-3.5",
  md: "h-7 gap-1.5 px-2 text-sm tracking-widest [&_svg]:size-4",
};

const LOOK_CLASSES: Readonly<Record<SimulatedBadgeLook, string>> = {
  tape: "border border-dashed border-status-warning text-status-warning hover:bg-surface-overlay",
};

export const SIMULATED_EXPLANATION =
  "Everything here is pretend. The computers, the network and the tools are part of a game running in your browser, so nothing you do reaches a real computer.";

/**
 * The "SIMULATED" marker (docs/plan/99-reference.md, §Simulation framing). It can't be dismissed.
 * It's a button only so keyboard and touch users can open its explanation; pressing it does
 * nothing else.
 *
 * **Once per view** (UIUX.md G3): the shell's top bar carries one, and so does every terminal,
 * because a terminal can appear on its own (a lesson's practice terminal) and its output must never
 * be mistaken for a real tool's. Nothing else adds another: not a case header, not a page
 * heading, not a pane inside a view that already shows one. Repeating it turns a trust signal
 * into noise.
 */
export function SimulatedBadge({
  size = "md",
  look = "tape",
  side,
  align,
  open,
  className,
}: SimulatedBadgeProps) {
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
          "inline-flex shrink-0 cursor-help items-center rounded-md font-mono font-semibold uppercase",
          LOOK_CLASSES[look],
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
