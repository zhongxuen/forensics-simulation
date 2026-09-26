"use client";

import { useRef, useState, type ReactNode } from "react";
import { useSkippableEffects } from "@/hooks/use-skippable-effects";
import { cx } from "@/lib/cx";
import { Badge } from "./badge";
import { CheckIcon } from "./icons";

/**
 * An objective is `open` until the case gets to it, `current` while it's the one to do now, and
 * `done` once the case checks it off, when it carries its success line.
 */
export type ObjectiveStatus =
  { status: "open" } | { status: "current" } | { status: "done"; success: ReactNode };

type ObjectiveTickProps = ObjectiveStatus & {
  /** The objective, starting with a verb: "Look around your home folder with `ls`." */
  children: ReactNode;
  /** An optional objective for the curious. Shows a "Bonus" badge. */
  bonus?: boolean;
  /**
   * Play the tick celebration on first render too. Normally it plays only when the status changes
   * to done while the objective is on screen, so a list that loads already done stays calm.
   */
  celebrate?: boolean;
  /**
   * More about the objective, under it and its success line: why it matters, a hint, an answer
   * box. Keep it calm: the tick is the celebration. A current objective shows it expanded, and
   * slides it in when the objective becomes current while on screen.
   */
  details?: ReactNode;
  className?: string;
};

/**
 * One objective in a case's list. When it's done, the box fills with the reward colour and a glow,
 * and the success line slides in beneath it, in text-primary behind a reward-coloured rule (the
 * reward colour marks the moment; the sentence stays easy to read). Under reduced motion the
 * filled box and success line simply appear. Any key skips the celebration.
 *
 * The current objective is the brightest thing in the list after the page's main button: a "Now"
 * eyebrow, an amber box, and its details open.
 *
 * Renders an <li>: put objectives in a <ul> or <ol>. The box isn't a control: cases tick
 * objectives, not players.
 */
export function ObjectiveTick(props: ObjectiveTickProps) {
  const { children, bonus = false, celebrate = false, details, className } = props;
  const done = props.status === "done";
  const current = props.status === "current";
  const rootRef = useRef<HTMLLIElement>(null);

  // Celebrate a change to done seen while mounted, and slide in the details of an objective that
  // becomes current (adjusting state while rendering).
  const [previousStatus, setPreviousStatus] = useState(props.status);
  const [celebrating, setCelebrating] = useState(celebrate && done);
  const [expanding, setExpanding] = useState(false);
  const [run, setRun] = useState(0);
  if (props.status !== previousStatus) {
    setPreviousStatus(props.status);
    setCelebrating(done);
    setExpanding(current);
    if (done) setRun(run + 1);
  }

  useSkippableEffects(rootRef, { enabled: celebrating, replayKey: run });

  return (
    <li
      ref={rootRef}
      aria-current={current ? "step" : undefined}
      className={cx(
        "flex gap-3",
        current && "-mx-3 rounded-lg border border-accent/40 bg-accent-subtle px-3 py-3",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          // Level with the objective's first line, which sits under the eyebrow when current.
          current ? "mt-4.5" : "mt-0.5",
          "grid size-6 shrink-0 place-items-center rounded-md border-2",
          done
            ? "border-reward bg-reward text-surface-base"
            : current
              ? "border-accent bg-surface-base text-transparent"
              : "border-strong bg-surface-base text-transparent",
          done && celebrating && "animate-tick-fill",
        )}
      >
        {done && (
          <span
            className={cx(
              "grid size-full place-items-center rounded-sm",
              celebrating && "animate-tick-glow",
            )}
          >
            <CheckIcon className="size-4" strokeWidth={3} />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        {current && (
          <p aria-hidden="true" className="type-eyebrow text-accent">
            Now
          </p>
        )}
        <p
          className={cx(
            "type-body",
            done ? "text-secondary" : "text-primary",
            current && "font-medium",
          )}
        >
          <span className="sr-only">{done ? "Done: " : current ? "Now: " : "To do: "}</span>
          {children}
          {bonus && (
            <Badge tone="accent" className="ml-2 align-middle">
              Bonus
            </Badge>
          )}
        </p>
        {/* Always rendered, so screen readers announce the success line when it arrives. */}
        <div aria-live="polite">
          {props.status === "done" && (
            <p
              className={cx(
                "mt-1 flex gap-1.5 border-l-2 border-reward pl-3 type-small font-medium text-primary",
                celebrating && "animate-rise-in",
              )}
            >
              {props.success}
            </p>
          )}
        </div>
        {details !== undefined && (
          <div className={cx(current && expanding && "animate-rise-in")}>{details}</div>
        )}
      </div>
    </li>
  );
}
