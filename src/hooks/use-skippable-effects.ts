import { useEffect, useRef, type RefObject } from "react";

/** The longest a celebration may run (src/styles/motion.css). After this there's nothing to skip. */
export const CELEBRATION_MAX_MS = 1500;

interface SkippableEffectsOptions {
  /** Listen only while true. Default true. Change `replayKey` to listen again after a replay. */
  enabled?: boolean;
  /** Anything that changes when the effect restarts, so the listener is set up again. */
  replayKey?: unknown;
  /** Called on skip, for effects that aren't CSS animations (a typewriter). */
  onSkip?: () => void;
}

/** Jump every running animation inside `element` to its end. */
export function finishAnimations(element: Element): void {
  for (const animation of element.getAnimations({ subtree: true })) {
    try {
      animation.finish();
    } catch {
      // A looping animation (a spinner) can't finish. It isn't a celebration, so leave it.
    }
  }
}

/**
 * Lets the learner skip a celebration with any key: its animations jump to their end, which is the
 * static reward. Listens for CELEBRATION_MAX_MS after it starts.
 *
 * Never blocks input: the key press still does whatever it normally does (the listener doesn't
 * prevent it), so typing into the terminal during a celebration works.
 */
export function useSkippableEffects(
  ref: RefObject<Element | null>,
  { enabled = true, replayKey, onSkip }: SkippableEffectsOptions = {},
): void {
  // The latest onSkip, without restarting the listener when a new function is passed each render.
  const onSkipRef = useRef(onSkip);
  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);

  useEffect(() => {
    if (!enabled) return;

    const skip = () => {
      if (ref.current) finishAnimations(ref.current);
      onSkipRef.current?.();
      stop();
    };
    const stop = () => {
      window.removeEventListener("keydown", skip);
      window.clearTimeout(timer);
    };

    window.addEventListener("keydown", skip);
    const timer = window.setTimeout(stop, CELEBRATION_MAX_MS);
    return stop;
  }, [enabled, replayKey, ref]);
}
