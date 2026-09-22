import { cx } from "@/lib/cx";
import { progressFraction } from "@/lib/progress";

/** `reward` is for celebrations only, such as a debrief summary. */
export type ProgressBarTone = "accent" | "reward";

interface ProgressBarProps {
  /** Shown above the bar, and its accessible name: "Scanning the office network". */
  label: string;
  /** How much is done. Leave out while the total is unknown: the bar then shows it's working. */
  value?: number;
  max: number;
  /** Show "3 / 8" beside the label. */
  showValue?: boolean;
  tone?: ProgressBarTone;
  className?: string;
}

const FILL_CLASSES: Readonly<Record<ProgressBarTone, string>> = {
  accent: "bg-accent",
  reward: "bg-reward",
};

/** A horizontal progress bar. Grows smoothly as `value` changes (instantly under reduced motion). */
export function ProgressBar({
  label,
  value,
  max,
  showValue = false,
  tone = "accent",
  className,
}: ProgressBarProps) {
  const indeterminate = value === undefined;
  const fraction = indeterminate ? 0 : progressFraction(value, max);
  const shownValue = Math.round(fraction * Math.max(0, max));

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-secondary">{label}</span>
        {showValue && (
          <span className="font-mono text-muted tabular-nums">
            {indeterminate ? "Working…" : `${shownValue} / ${max}`}
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : shownValue}
        aria-valuetext={indeterminate ? "Working" : `${shownValue} of ${max}`}
        aria-busy={indeterminate || undefined}
        className="relative h-2 overflow-hidden rounded-full bg-surface-overlay"
      >
        <div
          className={cx(
            "h-full rounded-full",
            FILL_CLASSES[tone],
            indeterminate
              ? "w-2/5 animate-indeterminate"
              : "transition-[width] fx-duration-slow ease-(--ease-standard)",
          )}
          style={indeterminate ? undefined : { width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
