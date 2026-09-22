"use client";

/**
 * Live demos and frozen pictures for the "Beginner and celebration" section. They need state,
 * refs or callbacks, which a server component can't hand to client components.
 */

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CoachMark, CoachMarkCard } from "@/components/ui/coach-mark";
import { ObjectiveTick } from "@/components/ui/objective-tick";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SecretFoundToast } from "@/components/ui/secret-found-toast";

const noop = () => {};

/** An inline command, as missions write them. */
export function Cmd({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.95em] text-primary">{children}</code>;
}

/** The success line for the "look around with ls" objective. */
export function LsSuccess() {
  return (
    <span>
      You listed your files! <Cmd>ls</Cmd> shows what&apos;s in the folder you&apos;re in.
    </span>
  );
}

const SECRET = {
  name: "Hide and seek",
  description: "Found a hidden file whose name starts with a dot.",
};

const TOUR_STEPS = [
  {
    title: "Your terminal",
    body: "This is where you type commands. Nothing you type here can reach a real computer.",
  },
  {
    title: "Stuck? Ask for a hint",
    body: "Hints are free, and using one never counts against you.",
  },
] as const;

/** One objective with a button that ticks it off, to watch the celebration. */
export function ObjectiveTickDemo() {
  const [done, setDone] = useState(false);

  return (
    <div className="flex max-w-xl flex-col items-start gap-4">
      <ul>
        {done ? (
          <ObjectiveTick status="done" success={<LsSuccess />}>
            Look around your home folder with <Cmd>ls</Cmd>.
          </ObjectiveTick>
        ) : (
          <ObjectiveTick status="open">
            Look around your home folder with <Cmd>ls</Cmd>.
          </ObjectiveTick>
        )}
      </ul>
      <Button size="sm" onClick={() => setDone(!done)}>
        {done ? "Reset" : "Complete objective"}
      </Button>
    </div>
  );
}

/** A ring with buttons to change the count, to watch it fill. */
export function ProgressRingDemo() {
  const [value, setValue] = useState(1);
  const max = 4;

  return (
    <div className="flex items-center gap-4">
      <ProgressRing value={value} max={max} label="Objectives done" size="lg" />
      <div className="flex flex-col items-start gap-2">
        <Button
          size="sm"
          onClick={() => setValue(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          Tick one off
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setValue(Math.max(0, value - 1))}
          disabled={value <= 0}
        >
          Undo one
        </Button>
      </div>
    </div>
  );
}

/** The toast, dismissable. Wrap in Replay to bring it back. */
export function SecretFoundToastDemo() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return <p className="text-sm text-muted">Dismissed. Press Play again to find it again.</p>;
  }
  return <SecretFoundToast {...SECRET} onDismiss={() => setDismissed(true)} />;
}

/** The toast as a frozen picture, with its Dismiss button. */
export function SecretFoundToastPicture() {
  return <SecretFoundToast {...SECRET} onDismiss={noop} />;
}

/** The coach mark card alone, as a frozen picture of one tour step. */
export function CoachMarkCardPicture({ step }: { step: 1 | 2 }) {
  const { title, body } = step === 1 ? TOUR_STEPS[0] : TOUR_STEPS[1];
  return (
    <CoachMarkCard
      title={title}
      step={step}
      totalSteps={TOUR_STEPS.length}
      onNext={noop}
      onSkip={noop}
      placement={step === 1 ? "bottom" : "top"}
    >
      {body}
    </CoachMarkCard>
  );
}

/** A pretend terminal and hint button, with a two-step tour over them. */
export function CoachMarkDemo() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const [step, setStep] = useState<number | null>(null);
  const current = step === null ? undefined : TOUR_STEPS[step];

  return (
    <div className="w-80 max-w-full space-y-3">
      <div
        ref={terminalRef}
        className="rounded-lg border border-subtle bg-term-bg px-3 py-2.5 font-mono text-sm text-term-fg"
      >
        recruit@training:~$ <span className="text-term-dim">type a command</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <span ref={hintRef} className="inline-flex">
          <Button size="sm">Show me a hint</Button>
        </span>
        <Button size="sm" variant="primary" onClick={() => setStep(0)}>
          Show the tour
        </Button>
      </div>
      {step !== null && current && (
        <CoachMark
          target={step === 0 ? terminalRef : hintRef}
          placement={step === 0 ? "bottom" : "top"}
          title={current.title}
          step={step + 1}
          totalSteps={TOUR_STEPS.length}
          onNext={() => setStep(step + 1 < TOUR_STEPS.length ? step + 1 : null)}
          onSkip={() => setStep(null)}
        >
          {current.body}
        </CoachMark>
      )}
    </div>
  );
}
