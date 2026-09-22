import { cx } from "@/lib/cx";
import { progressFraction } from "@/lib/progress";

export type ProgressRingSize = "sm" | "md" | "lg";

interface ProgressRingProps {
  /** How many are done, such as objectives completed in this mission. */
  value: number;
  /** How many there are in total. */
  max: number;
  /** What's being counted, as its accessible name: "Objectives done". */
  label: string;
  /** `sm` fits the top bar, with the count shown beside it; `md` and `lg` show the count inside. */
  size?: ProgressRingSize;
  className?: string;
}

const SIZES: Readonly<Record<ProgressRingSize, { px: number; stroke: number; text: string }>> = {
  sm: { px: 28, stroke: 3.5, text: "" },
  md: { px: 56, stroke: 5, text: "text-sm" },
  lg: { px: 88, stroke: 7, text: "text-xl" },
};

/**
 * Progress through the current mission's objectives. The ring fills when the count changes (a
 * short transition, instant under reduced motion), and turns the reward colour when everything is
 * done.
 */
export function ProgressRing({ value, max, label, size = "md", className }: ProgressRingProps) {
  const fraction = progressFraction(value, max);
  const complete = fraction === 1;
  const { px, stroke, text } = SIZES[size];
  const radius = (px - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shownValue = Math.round(fraction * Math.max(0, max));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={shownValue}
      aria-valuetext={`${shownValue} of ${max}`}
      className={cx("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: px, height: px }}
    >
      <svg viewBox={`0 0 ${px} ${px}`} className="-rotate-90" aria-hidden="true" focusable="false">
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-overlay"
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={cx(
            "transition-[stroke-dashoffset,stroke] fx-duration-slow ease-(--ease-standard)",
            // An empty ring draws no dot for its round cap.
            fraction === 0 ? "stroke-transparent" : complete ? "stroke-reward" : "stroke-accent",
          )}
        />
      </svg>
      {size !== "sm" && (
        <span
          aria-hidden="true"
          className={cx(
            "absolute font-mono font-semibold tabular-nums",
            text,
            complete ? "text-reward" : "text-primary",
          )}
        >
          {shownValue}/{max}
        </span>
      )}
    </div>
  );
}
