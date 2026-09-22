"use client";

import { useId, useState } from "react";
import type { AnnotatedProps } from "@/content/schemas/lesson-components";
import { cx } from "@/lib/cx";
import { GlossaryText } from "../glossary/glossary-text";

/**
 * Terminal output or a file, with numbered notes pinned to its lines. Every note is always on
 * screen, in order, so nothing hides behind a hover; picking a note highlights its line, and the
 * line's number badge matches the note's.
 *
 * Keyboard: each note is a button (Tab, then Enter or Space). The text scrolls sideways instead
 * of wrapping, and can be focused for that. Nothing animates.
 */
export function AnnotatedView({ title, code, notes }: AnnotatedProps) {
  const id = useId();
  const lines = code.replace(/\n$/, "").split("\n");
  const ordered = [...notes].sort((a, b) => a.line - b.line);
  const numberOf = new Map(ordered.map((note, index) => [note.line, index + 1]));
  const [active, setActive] = useState<number>(ordered[0]?.line ?? 1);

  return (
    <figure className="mt-8 rounded-lg border border-subtle bg-surface-raised">
      <figcaption className="flex items-center gap-3 border-b border-subtle px-4 py-2">
        <span className="text-sm font-medium text-secondary">
          {title ?? "Read it line by line"}
        </span>
        <span className="ml-auto text-xs text-muted">Pick a note to highlight its line</span>
      </figcaption>
      <pre
        tabIndex={0}
        aria-label={title ?? "Annotated example"}
        aria-describedby={`${id}-notes`}
        className="overflow-x-auto py-3 font-mono text-sm leading-6 text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
      >
        {lines.map((line, index) => {
          const number = numberOf.get(index + 1);
          return (
            <span
              key={index}
              className={cx(
                "flex gap-3 px-4",
                number !== undefined && active === index + 1 && "bg-accent-subtle",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full font-sans text-xs font-semibold",
                  number === undefined ? "text-transparent" : "bg-accent text-surface-base",
                )}
              >
                {number ?? ""}
              </span>
              <code className="whitespace-pre">{line === "" ? " " : line}</code>
            </span>
          );
        })}
      </pre>
      <ol id={`${id}-notes`} className="space-y-1 border-t border-subtle p-2">
        {ordered.map((note, index) => (
          <li key={note.line}>
            <button
              type="button"
              aria-pressed={active === note.line}
              onClick={() => setActive(note.line)}
              className="flex w-full gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring aria-pressed:bg-accent-subtle"
            >
              <span
                aria-hidden="true"
                className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-surface-base"
              >
                {index + 1}
              </span>
              <span className="min-w-0 leading-7">
                <span className="font-semibold text-primary">
                  <span className="sr-only">
                    Note {index + 1}, line {note.line}:{" "}
                  </span>
                  <GlossaryText text={note.label} />
                </span>
                <span className="block text-secondary">
                  <GlossaryText text={note.text} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </figure>
  );
}
