"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import { Button } from "./button";

/** Which side of the target the card sits on. */
export type CoachMarkPlacement = "top" | "bottom";

interface CoachMarkStep {
  /** What this step points at, in a few words: "Your terminal". */
  title: string;
  /** One or two short sentences about it. */
  children: ReactNode;
  /** 1-based. */
  step: number;
  totalSteps: number;
  /** Go to the next step. On the last step the button says "Done" and this ends the tour. */
  onNext: () => void;
  /** End the tour early. Escape does the same. */
  onSkip: () => void;
}

type CoachMarkCardProps = CoachMarkStep & {
  placement?: CoachMarkPlacement;
  /** Where the pointer arrow sits along the card's edge, in px from the left. Defaults to 32. */
  arrowLeft?: number;
  /** Fixed-position, for CoachMark. Otherwise the card sits in the page flow. */
  floating?: boolean;
  className?: string;
  style?: CSSProperties;
  cardRef?: RefObject<HTMLDivElement | null>;
};

/**
 * The coach mark's card on its own: step count, title, text, and Next / Skip tour. CoachMark
 * positions it next to its target; render it directly for a static preview.
 */
export function CoachMarkCard({
  title,
  children,
  step,
  totalSteps,
  onNext,
  onSkip,
  placement = "bottom",
  arrowLeft = 32,
  floating = false,
  className,
  style,
  cardRef,
}: CoachMarkCardProps) {
  const titleId = useId();
  const bodyId = useId();
  const last = step >= totalSteps;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onSkip();
        }
      }}
      style={style}
      className={cx(
        floating ? "fixed z-50 animate-fade-in" : "relative",
        "w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-strong bg-surface-overlay p-4 text-primary shadow-xl outline-none",
        className,
      )}
    >
      {/* The pointer: a small square turned 45°, half hidden behind the card's edge. */}
      <span
        aria-hidden="true"
        style={{ left: arrowLeft }}
        className={cx(
          "absolute size-3 -translate-x-1/2 rotate-45 border-strong bg-surface-overlay",
          placement === "bottom" ? "-top-1.5 border-t border-l" : "-bottom-1.5 border-r border-b",
        )}
      />
      <p className="text-sm text-muted">
        Step {step} of {totalSteps}
      </p>
      <h2 id={titleId} className="mt-1 text-lg leading-7 font-semibold">
        {title}
      </h2>
      <div id={bodyId} className="mt-1 leading-7 text-secondary">
        {children}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {!last && (
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip tour
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={onNext}>
          {last ? "Done" : "Next"}
        </Button>
      </div>
    </div>
  );
}

type CoachMarkProps = CoachMarkStep & {
  /** The element the step points at. */
  target: RefObject<HTMLElement | null>;
  /** Defaults to "bottom": the card below the target. */
  placement?: CoachMarkPlacement;
  /**
   * Move focus to the card when the step shows. Defaults to true. Turn it off for a step that
   * asks the learner to type somewhere (the terminal's prompt), so focus stays where they type.
   */
  focusCard?: boolean;
};

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Space between the target and the spotlight's edge, and between the spotlight and the card. */
const PAD = 6;
const GAP = 12;
const CARD_WIDTH = 320;
const EDGE = 16;

/**
 * A guided-tour pointer for first runs. It dims the page except for one element, rings that
 * element (the ring pulses twice, then holds still), and shows a card beside it with Next and Skip
 * tour.
 *
 * Nothing is blocked: the dimming lets clicks through, so the learner can use the highlighted
 * element straight away. Focus moves to the card on each step and goes back where it was when the
 * tour ends. Escape skips the tour.
 */
export function CoachMark({
  target,
  placement = "bottom",
  focusCard = true,
  ...step
}: CoachMarkProps) {
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Measure the target now and whenever the page scrolls or resizes, at most once a frame.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const element = target.current;
      if (!element) {
        setBox(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [target]);

  // Escape skips the tour wherever focus is. The latest onSkip, without re-subscribing.
  const onSkipRef = useRef(step.onSkip);
  useEffect(() => {
    onSkipRef.current = step.onSkip;
  }, [step.onSkip]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onSkipRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Put focus back where it was when the tour ends.
  useEffect(() => {
    const previous = document.activeElement;
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  // Move focus to the card on every step, once it's on screen (unless the step asks not to).
  const shown = box !== null;
  useEffect(() => {
    if (shown && focusCard) cardRef.current?.focus();
  }, [shown, step.step, focusCard]);

  // The card's height, so it can always be placed where all of it (Next included) is on screen.
  const [cardHeight, setCardHeight] = useState(0);
  useEffect(() => {
    const card = cardRef.current;
    if (!shown || !card) return;
    const observer = new ResizeObserver(() => setCardHeight(card.offsetHeight));
    observer.observe(card);
    return () => observer.disconnect();
  }, [shown]);

  if (!box) return null;

  const spot = {
    top: box.top - PAD,
    left: box.left - PAD,
    width: box.width + PAD * 2,
    height: box.height + PAD * 2,
  };
  const cardWidth = Math.min(CARD_WIDTH, viewport.width - EDGE * 2);
  const centre = box.left + box.width / 2;
  const cardLeft = Math.max(
    EDGE,
    Math.min(centre - cardWidth / 2, viewport.width - cardWidth - EDGE),
  );
  const arrowLeft = Math.max(EDGE, Math.min(centre - cardLeft, cardWidth - EDGE));
  const { side, top, clamped } = placeCard({
    placement,
    spotTop: spot.top,
    spotBottom: spot.top + spot.height,
    cardHeight,
    viewportHeight: viewport.height,
  });
  const cardPosition: CSSProperties = {
    top,
    left: cardLeft,
    // On a screen too short for the whole card, it scrolls inside itself instead of hanging off.
    maxHeight: viewport.height - EDGE * 2,
    overflowY: "auto",
  };

  return createPortal(
    <>
      <div
        aria-hidden="true"
        style={spot}
        className="pointer-events-none fixed z-40 rounded-lg shadow-[0_0_0_100vmax_color-mix(in_srgb,var(--surface-base)_72%,transparent)]"
      />
      <div
        aria-hidden="true"
        style={spot}
        className="pointer-events-none fixed z-40 animate-glow-pulse rounded-lg outline-2 outline-offset-0 outline-focus-ring"
      />
      <CoachMarkCard
        {...step}
        placement={side}
        arrowLeft={arrowLeft}
        cardRef={cardRef}
        style={cardPosition}
        className={clamped ? "[&>span:first-child]:hidden" : undefined}
        floating
      />
    </>,
    document.body,
  );
}

/**
 * Where the card goes: on the preferred side of the target if it fits there, else on the other
 * side if that has more room, and always inside the screen, so Next and Skip tour can be reached
 * on a short laptop screen too. When neither side has room it's pushed on screen over the target
 * (`clamped`), and its pointer is hidden, since it no longer sits beside what it points at.
 */
export function placeCard({
  placement,
  spotTop,
  spotBottom,
  cardHeight,
  viewportHeight,
}: {
  placement: CoachMarkPlacement;
  spotTop: number;
  spotBottom: number;
  cardHeight: number;
  viewportHeight: number;
}): { side: CoachMarkPlacement; top: number; clamped: boolean } {
  const roomBelow = viewportHeight - EDGE - (spotBottom + GAP);
  const roomAbove = spotTop - GAP - EDGE;
  const fits = (room: number) => cardHeight <= room;
  const side: CoachMarkPlacement =
    placement === "bottom"
      ? fits(roomBelow) || roomBelow >= roomAbove
        ? "bottom"
        : "top"
      : fits(roomAbove) || roomAbove >= roomBelow
        ? "top"
        : "bottom";
  const ideal = side === "bottom" ? spotBottom + GAP : spotTop - GAP - cardHeight;
  const highest = EDGE;
  const lowest = Math.max(EDGE, viewportHeight - EDGE - cardHeight);
  const top = Math.min(Math.max(ideal, highest), lowest);
  return { side, top, clamped: top !== ideal };
}
