"use client";

import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { cx } from "@/lib/cx";

export type TooltipSide = "top" | "bottom";

/** Which edge of the trigger the tooltip lines up with. Use `end` for triggers near the right edge. */
export type TooltipAlign = "start" | "center" | "end";

interface TooltipProps {
  /** A short explanation. Also read to screen reader users as the trigger's description. */
  content: ReactNode;
  /** The trigger: one focusable element, such as a button. It gets aria-describedby. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: TooltipSide;
  align?: TooltipAlign;
  /** Force it open or closed, for static previews. Leave out to let the learner control it. */
  open?: boolean;
  className?: string;
}

const SIDE_CLASSES: Readonly<Record<TooltipSide, string>> = {
  // Padding, not margin, bridges the gap to the trigger, so the pointer can move onto the tooltip.
  top: "bottom-full pb-2",
  bottom: "top-full pt-2",
};

const ALIGN_CLASSES: Readonly<Record<TooltipAlign, string>> = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
};

/**
 * A small explanation that appears beside a control. Opens on pointer hover, keyboard focus, and
 * tap. Escape closes it, and the pointer can move onto it without it vanishing (WCAG 1.4.13).
 *
 * Only for extra detail: anything the learner needs to act belongs on the page itself.
 */
export function Tooltip({
  content,
  children,
  side = "bottom",
  align = "center",
  open,
  className,
}: TooltipProps) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // Opened by a click or tap, so it stays open until focus leaves or the learner clicks elsewhere.
  const [pinned, setPinned] = useState(false);
  // Closed with Escape. Stays closed until the pointer leaves or focus moves on.
  const [dismissed, setDismissed] = useState(false);

  const shown = open ?? ((hovered || focused || pinned) && !dismissed);

  useEffect(() => {
    if (open !== undefined || !shown) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDismissed(true);
      setPinned(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPinned(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, shown]);

  const describedBy = [children.props["aria-describedby"], id].filter(Boolean).join(" ");

  return (
    <span
      ref={rootRef}
      className={cx("relative inline-flex", className)}
      onPointerEnter={() => setHovered(true)}
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
      onClick={() => {
        setPinned(true);
        setDismissed(false);
      }}
    >
      {cloneElement(children, { "aria-describedby": describedBy })}
      <span
        className={cx(
          "absolute z-50 w-max max-w-[min(18rem,calc(100vw-2rem))]",
          SIDE_CLASSES[side],
          ALIGN_CLASSES[align],
          !shown && "hidden",
        )}
      >
        <span
          id={id}
          role="tooltip"
          className="block animate-fade-in rounded-md border border-strong bg-surface-overlay px-3 py-2 text-left text-sm leading-5 font-normal tracking-normal text-primary normal-case shadow-lg"
        >
          {content}
        </span>
      </span>
    </span>
  );
}
