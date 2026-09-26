"use client";

import { useId, useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { cheatSheetGroups } from "../beginner/cheat-sheet";

interface CommandCheatSheetProps {
  /** Starts open. */
  defaultOpen?: boolean;
  /** A group's label to show first, like "Investigate" on the sandbox. The rest keep their order. */
  leadWith?: string;
  className?: string;
}

/**
 * Every command at a glance, grouped by what you might want to do, with a one-line summary and an
 * example each. It can fold away to give the terminal more room.
 */
export function CommandCheatSheet({
  defaultOpen = true,
  leadWith,
  className,
}: CommandCheatSheetProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const all = cheatSheetGroups();
  const groups = [
    ...all.filter((group) => group.label === leadWith),
    ...all.filter((group) => group.label !== leadWith),
  ];

  return (
    <section
      aria-labelledby={`${bodyId}-title`}
      className={cx("rounded-xl border border-subtle bg-surface-raised text-primary", className)}
    >
      <header className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-2">
        <h2 id={`${bodyId}-title`} className="text-sm font-semibold tracking-wide">
          Cheat sheet
        </h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className={buttonClassName({ variant: "ghost", size: "sm" })}
        >
          {open ? "Hide" : "Show"}
        </button>
      </header>
      {/* It scrolls, and holds nothing focusable, so it takes focus itself: arrow keys and Page
          Down then scroll it for keyboard users too (WCAG 2.1.1). */}
      <div
        id={bodyId}
        hidden={!open}
        role="region"
        aria-labelledby={`${bodyId}-title`}
        tabIndex={0}
        className="max-h-[32rem] space-y-5 overflow-y-auto px-4 py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
      >
        <p className="text-sm leading-6 text-secondary">
          Type any of these at the prompt. For the full story on one, type{" "}
          <code className="font-mono text-primary">man</code> and its name.
        </p>
        {groups.map((group) => (
          <div key={group.label}>
            <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
              {group.label}
            </h3>
            <dl className="mt-2 space-y-2">
              {group.entries.map((entry) => (
                <div key={entry.name}>
                  <dt className="font-mono text-sm font-semibold text-accent">{entry.name}</dt>
                  <dd className="text-sm leading-6 text-secondary">
                    {entry.summary.charAt(0).toUpperCase() + entry.summary.slice(1)}
                    {entry.example && (
                      <span className="mt-0.5 block font-mono text-xs text-muted">
                        e.g. <span className="text-primary">{entry.example.command}</span>
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
