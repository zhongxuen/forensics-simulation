import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

interface StampProps {
  /** A few words, stamped in capitals: "Case closed". */
  children: ReactNode;
  /**
   * Land it with the stamp animation: it drops in large, overshoots and settles, tilted 4°. Without
   * this (or under reduced motion) it's already stamped.
   */
  celebrate?: boolean;
  className?: string;
}

/**
 * A rubber stamp on a finished document: the debrief's "Case closed" (UIUX.md §5, the one big
 * moment). Reward-coloured, because it marks a moment rather than carrying text to read. Display
 * only: screen readers read its words.
 */
export function Stamp({ children, celebrate = false, className }: StampProps) {
  return (
    <span
      className={cx(
        "inline-block -rotate-4 rounded-md border-2 border-reward px-4 py-1 type-section-title tracking-widest text-reward uppercase outline-2 outline-offset-2 outline-reward/40",
        celebrate && "animate-stamp",
        className,
      )}
    >
      {children}
    </span>
  );
}
