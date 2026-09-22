import { useId, type ReactNode } from "react";
import { cx } from "@/lib/cx";

/** `terminal` gives the body the terminal palette, for tool output. */
export type PanelTone = "default" | "terminal";

interface PanelProps {
  title: ReactNode;
  /** The heading level that fits the page outline. */
  titleAs?: "h2" | "h3" | "h4";
  /** Small controls on the right of the header, such as a Reset button or the SIMULATED badge. */
  actions?: ReactNode;
  tone?: PanelTone;
  children: ReactNode;
  className?: string;
}

/**
 * A working surface with a header bar: the objectives list, the terminal, the map. Calm and
 * readable, like a precision instrument; celebrations happen elsewhere.
 */
export function Panel({
  title,
  titleAs: Heading = "h2",
  actions,
  tone = "default",
  children,
  className,
}: PanelProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cx(
        // No overflow-hidden: a tooltip in the header must be able to spill out.
        "rounded-xl border border-subtle bg-surface-raised text-primary",
        className,
      )}
    >
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-subtle px-4 py-2">
        <Heading id={titleId} className="text-sm font-semibold tracking-wide">
          {title}
        </Heading>
        {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div
        className={cx(
          "rounded-b-xl p-4",
          tone === "terminal" && "bg-term-bg font-mono text-sm leading-6 text-term-fg",
        )}
      >
        {children}
      </div>
    </section>
  );
}
