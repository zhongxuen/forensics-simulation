"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { PacketDiagramProps } from "@/content/schemas/lesson-components";
import { cx } from "@/lib/cx";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { GlossaryText } from "../glossary/glossary-text";

/**
 * A message broken into its parts, left to right, like the fields of a network packet. Each part
 * is a button: picking one shows what it's for underneath. Every note is also listed in order in
 * "Read every part", so nothing is only reachable by clicking.
 *
 * Keyboard: Tab reaches the parts, and the arrow keys (and Home and End) move between them. The
 * note is read out by a polite live region. Nothing moves, so there's no motion to reduce.
 */
export function PacketDiagramView({ title, fields, caption }: PacketDiagramProps) {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const field = fields[selected] ?? fields[0];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | undefined;
    if (event.key === "ArrowRight") next = (selected + 1) % fields.length;
    else if (event.key === "ArrowLeft") next = (selected - 1 + fields.length) % fields.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = fields.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    setSelected(next);
    buttons.current[next]?.focus();
  };

  return (
    <figure className="mt-8 rounded-xl border border-subtle bg-surface-raised p-5">
      <figcaption>
        <p className="font-semibold text-primary">{title}</p>
        <p className="mt-1 text-sm text-secondary">Pick a part to see what it&apos;s for.</p>
      </figcaption>

      <div
        role="group"
        aria-label={`${title}, part by part`}
        onKeyDown={onKeyDown}
        className="mt-4 flex overflow-x-auto rounded-lg border border-strong"
      >
        {fields.map((part, index) => (
          <button
            key={`${part.label}-${index}`}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            aria-pressed={selected === index}
            aria-controls={`${id}-note`}
            onClick={() => setSelected(index)}
            style={{ flexGrow: part.size, flexBasis: `${part.size * 3.5}rem` }}
            className={cx(
              "min-w-24 border-r border-subtle px-3 py-2 text-left last:border-r-0",
              "hover:bg-surface-overlay aria-pressed:bg-accent-subtle aria-pressed:shadow-[inset_0_-3px_0_var(--accent)]",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
            )}
          >
            <span className="block font-mono text-xs text-muted">{index + 1}</span>
            <span className="block text-sm font-semibold text-primary">{part.label}</span>
            {part.value !== undefined && (
              <span className="block truncate font-mono text-sm text-accent">{part.value}</span>
            )}
          </button>
        ))}
      </div>

      {field && (
        <div
          id={`${id}-note`}
          aria-live="polite"
          className="mt-4 rounded-lg border-l-4 border-l-accent bg-surface-overlay px-4 py-3"
        >
          <p className="font-semibold text-primary">
            {selected + 1}. {field.label}
            {field.value !== undefined && (
              <code className="ml-2 font-mono text-sm text-accent">{field.value}</code>
            )}
          </p>
          <p className="mt-1 leading-7 text-secondary">
            <GlossaryText text={field.note} />
          </p>
        </div>
      )}

      <details className="mt-4">
        <summary
          className={cx("cursor-pointer rounded-sm text-sm font-semibold text-primary", FOCUS_RING)}
        >
          Read every part, in order
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-6 leading-7 text-secondary marker:text-muted">
          {fields.map((part, index) => (
            <li key={`${part.label}-${index}`}>
              <span className="font-medium text-primary">{part.label}</span>
              {part.value !== undefined && (
                <code className="ml-2 font-mono text-sm text-accent">{part.value}</code>
              )}
              : <GlossaryText text={part.note} />
            </li>
          ))}
        </ol>
      </details>

      {caption !== undefined && (
        <p className="mt-4 text-sm leading-6 text-muted">
          <GlossaryText text={caption} />
        </p>
      )}
    </figure>
  );
}
