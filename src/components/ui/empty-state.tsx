import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

interface EmptyStateProps {
  /** Decorative. */
  icon?: ReactNode;
  /** What will be here: "Your network map is still dark". */
  title: string;
  /** Why it's empty right now, in a sentence or two. */
  description: ReactNode;
  /** The one action that fills it, usually a ButtonLink. */
  action?: ReactNode;
  titleAs?: "h2" | "h3" | "h4";
  className?: string;
}

/**
 * Stands in for content that isn't there yet. Never "No data": say what will be here, why it's
 * empty, and the one thing that fills it (md-files/voice-and-tone.md, "Empty state").
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  titleAs: Heading = "h2",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center rounded-xl border border-dashed border-strong px-6 py-10 text-center",
        className,
      )}
    >
      {icon !== undefined && (
        <div
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-full bg-surface-overlay text-accent [&_svg]:size-6"
        >
          {icon}
        </div>
      )}
      <Heading
        className={cx(
          "text-lg font-semibold text-balance text-primary",
          icon !== undefined && "mt-4",
        )}
      >
        {title}
      </Heading>
      <p className="mt-2 max-w-md leading-7 text-pretty text-secondary">{description}</p>
      {action !== undefined && <div className="mt-6">{action}</div>}
    </div>
  );
}
