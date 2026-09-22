"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Button } from "./button";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CloseIcon,
  InfoIcon,
  WarningIcon,
  type IconProps,
} from "./icons";

export type ToastTone = "info" | "success" | "warning" | "danger";

const TONES: Readonly<
  Record<ToastTone, { icon: ComponentType<IconProps>; word: string; text: string; edge: string }>
> = {
  info: { icon: InfoIcon, word: "Note", text: "text-status-info", edge: "border-l-status-info" },
  success: {
    icon: CheckCircleIcon,
    word: "Done",
    text: "text-status-success",
    edge: "border-l-status-success",
  },
  warning: {
    icon: WarningIcon,
    word: "Heads up",
    text: "text-status-warning",
    edge: "border-l-status-warning",
  },
  danger: {
    icon: AlertCircleIcon,
    word: "Problem",
    text: "text-status-danger",
    edge: "border-l-status-danger",
  },
};

interface ToastProps {
  tone: ToastTone;
  /** One short sentence: what happened. */
  title: string;
  /** What it means, or what to try next. */
  description?: ReactNode;
  /** One follow-up action, such as a small Button. */
  action?: ReactNode;
  /** Shows a Dismiss button. The caller removes the toast from its list. */
  onDismiss?: () => void;
  /**
   * Dismiss on its own after this long. Paused while the pointer or keyboard focus is on the
   * toast. Leave out for anything the learner must read; `danger` toasts shouldn't vanish.
   */
  autoDismissMs?: number;
  className?: string;
}

/**
 * A brief message about something that just happened. Icon, colour and words together, never
 * colour alone. Problems are announced straight away; everything else waits its turn in the
 * ToastViewport's live region.
 */
export function Toast({
  tone,
  title,
  description,
  action,
  onDismiss,
  autoDismissMs,
  className,
}: ToastProps) {
  const { icon: ToneIcon, word, text, edge } = TONES[tone];
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  // The latest onDismiss, so a new function each render doesn't restart the timer.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (autoDismissMs === undefined || paused) return;
    // Starts over after a pause, so the learner always gets the full time to finish reading.
    const timer = window.setTimeout(() => onDismissRef.current?.(), autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs, paused]);

  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className={cx(
        "pointer-events-auto flex w-full max-w-sm animate-fade-in gap-3 rounded-lg border border-l-4 border-subtle bg-surface-overlay py-3 pr-2 pl-4 text-primary shadow-xl",
        edge,
        className,
      )}
    >
      <ToneIcon className={cx("mt-0.5 size-5 shrink-0", text)} />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="leading-6 font-semibold">
          <span className="sr-only">{word}: </span>
          {title}
        </p>
        {description !== undefined && (
          <div className="mt-0.5 text-sm leading-6 text-secondary">{description}</div>
        )}
        {action !== undefined && <div className="mt-3">{action}</div>}
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          label="Dismiss"
          icon={<CloseIcon />}
          onClick={onDismiss}
          className="shrink-0"
        />
      )}
    </div>
  );
}

interface ToastViewportProps {
  /** The toasts, newest last. */
  children: ReactNode;
  /** Adjust where the stack sits, for example to clear a bar pinned to the bottom of the screen. */
  className?: string;
}

/**
 * Where toasts stack: the bottom of the screen on phones, the bottom right on wider screens. A
 * polite live region, so new toasts are read out without interrupting. It never catches clicks
 * itself, so it doesn't block the page under it.
 */
export function ToastViewport({ children, className }: ToastViewportProps) {
  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      aria-relevant="additions text"
      className={cx(
        "pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end",
        className,
      )}
    >
      {children}
    </section>
  );
}
