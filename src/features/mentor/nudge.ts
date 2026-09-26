"use client";

import { useEffect, useState } from "react";

/**
 * The "Want a nudge?" chip (docs/plan/14-mentor.md, "Gently offers, never interrupts"). The mentor
 * never opens anything by itself. When the player seems stuck — several attempts that didn't work
 * since their last tick, or a few minutes without a new one — a small chip offers a nudge. They can
 * dismiss it (it stays away until their next tick), and turn it off in Settings.
 */

/** Attempts that didn't work (commands that errored, answers that weren't it) since the last tick. */
export const NUDGE_FAILED_ATTEMPTS = 3;

/** Minutes without a new tick before the chip offers help. */
export const NUDGE_IDLE_MS = 3 * 60_000;

export interface NudgeSignals {
  /** Attempts that didn't work since the player's last tick. */
  readonly failuresSinceProgress: number;
  /** Whether the idle time has passed since the last tick. */
  readonly idle: boolean;
}

/** Whether the player seems stuck: the stuck threshold, pure so it's easy to test. */
export function seemsStuck(
  signals: NudgeSignals,
  failureThreshold: number = NUDGE_FAILED_ATTEMPTS,
): boolean {
  return signals.idle || signals.failuresSinceProgress >= failureThreshold;
}

export interface UseNudgeOptions {
  /** Objectives ticked so far. A new tick is progress: the count starts over and the chip goes. */
  readonly progress: number;
  /** Every attempt that didn't work in this run, so far. */
  readonly failures: number;
  /**
   * Whether the chip may show at all: the setting is on, there's a hint left to give, and the
   * mentor panel isn't already open.
   */
  readonly enabled: boolean;
  readonly idleMs?: number;
  readonly failureThreshold?: number;
}

export interface Nudge {
  readonly show: boolean;
  /** Hides the chip until the player's next tick. */
  readonly dismiss: () => void;
}

export function useNudge({
  progress,
  failures,
  enabled,
  idleMs = NUDGE_IDLE_MS,
  failureThreshold = NUDGE_FAILED_ATTEMPTS,
}: UseNudgeOptions): Nudge {
  const [baseline, setBaseline] = useState({ progress, failures });
  const [idle, setIdle] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // A new tick is progress: count from here, and put the idle clock back to zero (adjusting state
  // while rendering, so there's no frame where a stale chip shows).
  if (progress !== baseline.progress) {
    setBaseline({ progress, failures });
    setIdle(false);
    setDismissed(false);
  }

  // The idle clock runs from the last tick. It restarts whenever progress changes.
  useEffect(() => {
    const timer = window.setTimeout(() => setIdle(true), idleMs);
    return () => window.clearTimeout(timer);
  }, [progress, idleMs]);

  const stuck = seemsStuck(
    { failuresSinceProgress: failures - baseline.failures, idle },
    failureThreshold,
  );
  return { show: enabled && !dismissed && stuck, dismiss: () => setDismissed(true) };
}
