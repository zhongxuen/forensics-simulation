/**
 * Injected time. The engine never reads the real clock: callers pass a `Clock`, and `step` calls
 * `now()` exactly once per command. The app can pass the wall clock; tests and replays pass one of
 * the deterministic clocks below.
 */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

/** A clock that is always `ms`. The simplest test clock. */
export function fixedClock(ms: number): Clock {
  assertInstant(ms);
  return { now: () => ms };
}

/**
 * A clock that returns `startMs` on the first call, then moves forward `stepMs` on every call.
 * Because `step` reads the clock once per command, the nth command always happens at
 * `startMs + n * stepMs`.
 */
export function steppingClock(startMs: number, stepMs = 1000): Clock {
  assertInstant(startMs);
  if (!Number.isFinite(stepMs) || stepMs < 0) throw new RangeError("stepMs must be >= 0");
  let next = startMs;
  return {
    now: () => {
      const current = next;
      next += stepMs;
      return current;
    },
  };
}

/** Parses an ISO-8601 timestamp such as "2026-03-02T09:00:00Z". Deterministic: no ambient time. */
export function parseInstant(iso: string): number | undefined {
  // Require an explicit zone, so the result never depends on the machine's local time zone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(iso)) {
    return undefined;
  }
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : undefined;
}

/** Formats a timestamp as ISO-8601 UTC without milliseconds: "2026-03-02T09:00:00Z". */
export function formatInstant(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function assertInstant(ms: number): void {
  if (!Number.isFinite(ms)) throw new RangeError(`clock time must be a finite number, got ${ms}`);
}
