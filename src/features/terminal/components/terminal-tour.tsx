"use client";

import type { RefObject } from "react";
import { CoachMark } from "@/components/ui/coach-mark";
import { CheckCircleIcon } from "@/components/ui/icons";
import { TERMINAL_TOUR } from "../beginner/tour";
import { CopyText } from "./styled-text";

export interface TourProgress {
  /** Which step is showing: TERMINAL_TOUR.length is the closing card. */
  readonly index: number;
  /** The success line of the step just completed, shown at the top of the next card. */
  readonly success?: string;
}

interface TerminalTourProps {
  progress: TourProgress;
  onNext: () => void;
  onEnd: () => void;
  /** What the tour points at: the terminal's header, and its prompt. */
  headerRef: RefObject<HTMLElement | null>;
  promptRef: RefObject<HTMLElement | null>;
}

/**
 * The guided first run, on the phase 02 CoachMark. Steps that ask the learner to type leave focus
 * at the prompt, and move on by themselves once the command works; the card for the next step
 * opens with a tick and the success line.
 */
export function TerminalTour({ progress, onNext, onEnd, headerRef, promptRef }: TerminalTourProps) {
  const total = TERMINAL_TOUR.length + 1;
  const step = TERMINAL_TOUR[progress.index];
  const success = progress.success && (
    <p className="mb-2 flex gap-2 text-primary">
      <CheckCircleIcon className="mt-1 size-4.5 shrink-0 text-status-success" />
      <span>
        <CopyText text={progress.success} codeClassName="text-accent" />
      </span>
    </p>
  );

  if (!step) {
    return (
      <CoachMark
        target={promptRef}
        placement="top"
        title="You're ready"
        step={total}
        totalSteps={total}
        onNext={onEnd}
        onSkip={onEnd}
      >
        {success}
        <p>
          That&apos;s the terminal. Type <code className="font-mono text-accent">help</code> any
          time to see every command. You can replay this tour from the Help menu.
        </p>
      </CoachMark>
    );
  }

  return (
    <CoachMark
      target={step.target === "terminal" ? headerRef : promptRef}
      placement={step.target === "terminal" ? "bottom" : "top"}
      focusCard={!step.waitFor}
      title={step.title}
      step={progress.index + 1}
      totalSteps={total}
      onNext={onNext}
      onSkip={onEnd}
    >
      {success}
      <p>
        <CopyText text={step.body} codeClassName="text-accent" />
      </p>
    </CoachMark>
  );
}
