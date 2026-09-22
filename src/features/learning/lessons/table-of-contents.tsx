import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";
import type { TocEntry } from "./remark-lesson";

interface TableOfContentsProps {
  entries: readonly TocEntry[];
  /** Shows an "On this page" heading with this id. Leave out where something else labels it. */
  headingId?: string;
  className?: string;
}

/**
 * "On this page": a link to every section of a lesson, built from its headings. Hidden when a
 * lesson has fewer than two sections, since a one-item list helps nobody.
 */
export function TableOfContents({ entries, headingId, className }: TableOfContentsProps) {
  if (entries.length < 2) return null;

  return (
    <nav
      aria-labelledby={headingId}
      aria-label={headingId === undefined ? "On this page" : undefined}
      className={className}
    >
      {headingId !== undefined && (
        <h2 id={headingId} className="mb-3 text-sm font-semibold text-primary">
          On this page
        </h2>
      )}
      <ol className="space-y-1 border-l border-subtle text-sm">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={cx(
                "-ml-px block rounded-r-sm border-l border-transparent py-1 pr-2 leading-5 text-secondary hover:border-strong hover:text-primary",
                entry.depth === 3 ? "pl-7" : "pl-4",
                FOCUS_RING,
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
