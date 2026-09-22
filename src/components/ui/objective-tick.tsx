"use client";

import { useRef, useState, type ReactNode } from "react";
import { useSkippableEffects } from "@/hooks/use-skippable-effects";
import { cx } from "@/lib/cx";
import { Badge } from "./badge";
import { CheckIcon } from "./icons";

/** An objective is open until the mission checks it off, then it carries its success line. */
export type ObjectiveStatus = { status: "open" } | { status: "done"; success: ReactNode };

type ObjectiveTickProps = ObjectiveStatus & {
  /** The objective, starting with a verb: "Look around your home folder with `ls`." */
  children: ReactNode;
  /** An optional objective for the curious. Shows a "Bonus" badge. */
  bonus?: boolean;
  /**
   * Play the tick celebration on first render too. Normally it plays only when the status changes
   * from open to done while the objective is on screen, so a list that loads already done stays
   * calm.
   */
  celebrate?: boolean;
  /**
   * More about the objective, under it and its success line: why it matters, a hint, an answer
   * box. Keep it calm: the tick is the celebration.
   */
  details?: ReactNode;
  className?: string;
};

/**
 * One objective in a mission's list. When it's done, the box fills with the reward colour and a
 * glow, and the objective's success line slides in beneath it. Under reduced motion the filled box
 * and success line simply appear. Any key skips the celebration.
 *
 * Renders an <li>: put objectives in a <ul> or <ol>. The box isn't a control: missions tick
 * objectives, not learners.
 */
export function ObjectiveTick(props: ObjectiveTickProps) {
  const { children, bonus = false, celebrate = false, details, className } = props;
  const done = props.status === "done";
  const rootRef = useRef<HTMLLIElement>(null);

  // Celebrate an open → done change seen while mounted (adjusting state while rendering).
  const [previousStatus, setPreviousStatus] = useState(props.status);
  const [celebrating, setCelebrating] = useState(celebrate && done);
  const [run, setRun] = useState(0);
  if (props.status !== previousStatus) {
    setPreviousStatus(props.status);
    setCelebrating(done);
    if (done) setRun(run + 1);
  }

  useSkippableEffects(rootRef, { enabled: celebrating, replayKey: run });

  return (
    <li ref={rootRef} className={cx("flex gap-3", className)}>
      <span
        aria-hidden="true"
        className={cx(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2",
          done
            ? "border-reward bg-reward text-surface-base"
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
        <p className={cx("leading-7", done ? "text-secondary" : "text-primary")}>
          <span className="sr-only">{done ? "Done: " : "To do: "}</span>
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
                "mt-1 flex gap-1.5 text-sm leading-6 font-medium text-reward",
                celebrating && "animate-rise-in",
              )}
            >
              {props.success}
            </p>
          )}
        </div>
        {details}
      </div>
    </li>
  );
}
