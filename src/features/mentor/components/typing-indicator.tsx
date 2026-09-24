import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";

const DOT_DELAYS_MS = [0, 160, 320] as const;

/**
 * Three dots that rise in turn while Noor writes, and the words for it (the words carry the meaning;
 * the dots are decorative). A loading indicator, so the dots loop until the reply lands. Under
 * reduced motion they stand still (src/styles/motion.css, `animate-typing-dot`), and the words still
 * say what's happening.
 */
export function TypingIndicator({ label, className }: { label?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-secondary", className)}>
      <span aria-hidden="true" className="inline-flex h-4 items-end gap-1 pb-0.5">
        {DOT_DELAYS_MS.map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-typing-dot rounded-full bg-accent opacity-60"
            style={{ "--typing-delay": `${delay}ms` } as CSSProperties}
          />
        ))}
      </span>
      {label ? <span>{label}</span> : <span className="sr-only">Still writing</span>}
    </span>
  );
}
