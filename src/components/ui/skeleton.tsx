import { cx } from "@/lib/cx";

interface SkeletonProps {
  /** What's loading, for screen readers: "Loading the timeline". */
  label: string;
  /** How many rows to draw. Default 3. */
  rows?: number;
  className?: string;
}

/** Row widths, so a column of rows reads as text rather than a wall. */
const WIDTHS = ["w-full", "w-11/12", "w-4/5", "w-2/3", "w-5/6"] as const;

/**
 * Grey rows in the shape of what's coming, with a slow shimmer, while a pane loads (UIUX.md §5).
 * Under reduced motion the rows stand still. Screen readers hear the label once, as a status, and
 * never the rows.
 */
export function Skeleton({ label, rows = 3, className }: SkeletonProps) {
  return (
    <div role="status" className={cx("space-y-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={cx(
            "h-4 animate-shimmer rounded-md fx-skeleton",
            WIDTHS[index % WIDTHS.length],
          )}
        />
      ))}
    </div>
  );
}
