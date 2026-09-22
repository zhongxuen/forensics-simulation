"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { ArrowRightIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { GlossaryText } from "./glossary-text";

interface TermPopoverProps {
  /** The glossary id, for the "Open in the glossary" link. */
  id: string;
  term: string;
  short: string;
  /** The words in the sentence. */
  children: ReactNode;
}

/** Space kept between the card and the edge of the screen, in pixels. */
const VIEWPORT_MARGIN = 16;

/**
 * An inline glossary word with a definition card. The card opens on mouse hover, on keyboard
 * focus, and on tap. A click or tap keeps it open until the next one, Escape closes it, and the
 * pointer can move onto it without it vanishing (WCAG 1.4.13).
 *
 * The trigger is a button, not a link, so a tap on a phone shows the definition instead of leaving
 * the page. The card holds the link to the full glossary entry, and Tab reaches it straight after
 * the word. Screen readers hear the definition as the button's description.
 */
export function TermPopover({ id, term, short, children }: TermPopoverProps) {
  const cardId = useId();
  const definitionId = `${cardId}-definition`;
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // Opened by a click or tap: stays open until the next click, Escape, or focus leaves.
  const [pinned, setPinned] = useState(false);
  // Closed with Escape or a second click: stays closed until the pointer or focus leaves.
  const [dismissed, setDismissed] = useState(false);
  // How far to slide the card left so it doesn't run off the right edge.
  const [shift, setShift] = useState(0);

  const open = (hovered || focused || pinned) && !dismissed;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDismissed(true);
      setPinned(false);
      if (cardRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setPinned(false);
      setHovered(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const card = cardRef.current;
    if (!open || !trigger || !card) return;
    const left = trigger.getBoundingClientRect().left;
    const overflow = left + card.offsetWidth - (window.innerWidth - VIEWPORT_MARGIN);
    setShift(overflow > 0 ? Math.max(-overflow, VIEWPORT_MARGIN - left) : 0);
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="relative inline"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
        setDismissed(false);
      }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setFocused(false);
        setPinned(false);
        setDismissed(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={cardId}
        aria-describedby={definitionId}
        onClick={() => {
          if (pinned) {
            setPinned(false);
            setDismissed(true);
          } else {
            setPinned(true);
            setDismissed(false);
          }
        }}
        className={cx(
          "cursor-help rounded-sm text-left underline decoration-accent decoration-dotted decoration-2 underline-offset-4 hover:text-accent",
          open && "text-accent",
          FOCUS_RING,
        )}
      >
        {children}
      </button>
      <span
        ref={cardRef}
        id={cardId}
        style={shift === 0 ? undefined : { transform: `translateX(${shift}px)` }}
        // Padding, not margin, bridges the gap, so the pointer can move onto the card.
        className={cx(
          "absolute top-full left-0 z-40 block w-max max-w-[min(20rem,calc(100vw-2rem))] pt-2",
          !open && "hidden",
        )}
      >
        <span className="block animate-fade-in rounded-lg border border-strong bg-surface-overlay p-3 text-left text-sm leading-6 font-normal tracking-normal normal-case not-italic shadow-lg">
          <span className="block font-semibold text-primary">{term}</span>
          <span id={definitionId} className="mt-1 block text-secondary">
            <GlossaryText text={short} />
          </span>
          <Link
            href={`/learn/glossary#${id}`}
            className={cx(
              "mt-2 inline-flex items-center gap-1 rounded-sm font-medium text-accent hover:underline",
              FOCUS_RING,
            )}
          >
            Open in the glossary
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </span>
      </span>
    </span>
  );
}
