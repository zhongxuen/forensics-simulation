"use client";

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cx } from "@/lib/cx";
import { FOCUS_RING } from "./focus-ring";

/** How far one arrow key press moves the handle, in percent of the whole width. */
export const SPLIT_PANE_STEP = 5;

/** Controlled (`ratio` with `onRatioChange`), or uncontrolled from `defaultRatio`. */
type SplitPaneRatio =
  | { ratio: number; onRatioChange: (ratio: number) => void }
  | { ratio?: never; onRatioChange?: (ratio: number) => void };

type SplitPaneProps = SplitPaneRatio & {
  /** The left pane: the terminal, in the case workspace. */
  start: ReactNode;
  /** The right pane. */
  end: ReactNode;
  /** The handle's accessible name: "Resize the terminal and the case views". */
  label: string;
  /** The start pane's share of the width, in percent, at first and after a reset. Default 50. */
  defaultRatio?: number;
  /** The narrowest the start pane may get, in percent. Default 20. */
  min?: number;
  /** The widest the start pane may get, in percent. Default 80. */
  max?: number;
  className?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Two panes side by side with a handle between them (the WAI-ARIA window splitter pattern). The
 * handle is a focusable separator whose value is the start pane's width in percent:
 *
 * - Drag it with a mouse, pen or finger.
 * - Arrow Left and Right (or Down and Up) move it 5%; Home and End snap it to the narrowest and
 *   widest the start pane may be.
 * - Double-click, or Enter, puts it back where it started.
 *
 * A keyboard move eases into place (fx-slide, instant under reduced motion); a drag follows the
 * pointer with no easing.
 */
export function SplitPane({
  start,
  end,
  label,
  defaultRatio = 50,
  min = 20,
  max = 80,
  ratio,
  onRatioChange,
  className,
}: SplitPaneProps) {
  const startId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [internal, setInternal] = useState(() => clamp(defaultRatio, min, max));
  const [dragging, setDragging] = useState(false);

  const value = clamp(ratio ?? internal, min, max);

  const set = (next: number) => {
    const clamped = Math.round(clamp(next, min, max) * 10) / 10;
    if (ratio === undefined) setInternal(clamped);
    onRatioChange?.(clamped);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | undefined;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = value - SPLIT_PANE_STEP;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = value + SPLIT_PANE_STEP;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    else if (event.key === "Enter") next = defaultRatio;
    if (next === undefined) return;
    event.preventDefault();
    set(next);
  };

  const ratioAt = (clientX: number) => {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return value;
    return ((clientX - box.left) / box.width) * 100;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging) set(ratioAt(event.clientX));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  return (
    <div ref={rootRef} className={cx("flex min-h-0 min-w-0", className)}>
      <div
        id={startId}
        className={cx("min-h-0 min-w-0 shrink-0 overflow-auto", !dragging && "fx-slide")}
        style={{ flexBasis: `${value}%` }}
      >
        {start}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-controls={startId}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => set(defaultRatio)}
        className={cx(
          "group relative w-3 shrink-0 cursor-col-resize touch-none select-none",
          FOCUS_RING,
        )}
      >
        {/* The visible rule; the whole 12px column takes the pointer. */}
        <span
          aria-hidden="true"
          className={cx(
            "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors",
            dragging ? "bg-accent" : "bg-(--border-strong) group-hover:bg-accent",
          )}
        />
        {/* A grip in the middle, so it reads as something you can move. */}
        <span
          aria-hidden="true"
          className={cx(
            "absolute top-1/2 left-1/2 h-8 w-1.5 -translate-1/2 rounded-full border transition-colors",
            dragging
              ? "border-accent bg-accent"
              : "border-strong bg-surface-overlay group-hover:border-accent",
          )}
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{end}</div>
    </div>
  );
}
