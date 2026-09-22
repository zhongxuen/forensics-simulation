import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { BookOpenIcon, LightbulbIcon, WarningIcon } from "./icons";

/**
 * `tip`: a helpful shortcut or next step. `concept`: a new idea, explained before a mission needs
 * it. `warning`: something to watch out for. Never used for errors: those say what happened and
 * what to try next, in place.
 */
export type CalloutKind = "tip" | "concept" | "warning";

const KINDS: Readonly<
  Record<CalloutKind, { label: string; Icon: typeof LightbulbIcon; border: string; text: string }>
> = {
  tip: { label: "Tip", Icon: LightbulbIcon, border: "border-l-accent", text: "text-accent" },
  concept: {
    label: "New idea",
    Icon: BookOpenIcon,
    border: "border-l-status-info",
    text: "text-status-info",
  },
  warning: {
    label: "Heads up",
    Icon: WarningIcon,
    border: "border-l-status-warning",
    text: "text-status-warning",
  },
};

interface CalloutProps {
  kind: CalloutKind;
  /** Shown as the label. Defaults to the kind's own label ("Tip", "New idea", "Heads up"). */
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A short aside inside content. Colour, icon and a visible label together, so the kind never
 * depends on colour alone.
 */
export function Callout({ kind, title, children, className }: CalloutProps) {
  const { label, Icon, border, text } = KINDS[kind];

  return (
    <div
      role="note"
      className={cx(
        "rounded-lg border border-l-4 border-subtle bg-surface-raised px-4 py-3",
        border,
        className,
      )}
    >
      <p className={cx("flex items-center gap-2 text-sm font-semibold", text)}>
        <Icon className="size-4.5 shrink-0" />
        {title ?? label}
      </p>
      <div className="mt-1.5 space-y-2 leading-7 text-secondary">{children}</div>
    </div>
  );
}
