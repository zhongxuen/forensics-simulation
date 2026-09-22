import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Colours the value and icon. The label says what it means, so colour is never the only signal. */
export type StatTileTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Readonly<Record<StatTileTone, string>> = {
  neutral: "text-primary",
  accent: "text-accent",
  success: "text-status-success",
  warning: "text-status-warning",
  danger: "text-status-danger",
  info: "text-status-info",
};

interface StatTileProps {
  /** What's counted: "Computers found". */
  label: string;
  value: ReactNode;
  /** One short line of context: "in the office network". */
  hint?: ReactNode;
  /** Decorative, shown before the label. */
  icon?: ReactNode;
  tone?: StatTileTone;
  /** Shows a placeholder while the number is being worked out. */
  loading?: boolean;
  className?: string;
}

/** One number with its label, such as "Computers found: 4". Display only. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  loading = false,
  className,
}: StatTileProps) {
  return (
    <dl
      className={cx("rounded-xl border border-subtle bg-surface-raised p-4", className)}
      aria-busy={loading || undefined}
    >
      <dt className="flex items-center gap-2 text-sm font-medium text-secondary">
        {icon !== undefined && (
          <span aria-hidden="true" className={cx("[&_svg]:size-4", TONE_CLASSES[tone])}>
            {icon}
          </span>
        )}
        {label}
      </dt>
      <dd className="mt-1">
        {loading ? (
          <>
            <span
              aria-hidden="true"
              className="mt-1 block h-8 w-16 rounded-md bg-surface-overlay"
            />
            <span className="sr-only">Loading</span>
          </>
        ) : (
          <span className={cx("block text-3xl font-semibold tabular-nums", TONE_CLASSES[tone])}>
            {value}
          </span>
        )}
      </dd>
      {hint !== undefined && <dd className="mt-1 text-sm text-muted">{hint}</dd>}
    </dl>
  );
}
