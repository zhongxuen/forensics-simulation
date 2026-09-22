/**
 * How far along something is, from 0 to 1: `value` out of `max`. Clamped, so a count past the
 * total reads as done and a negative or missing total reads as not started.
 */
export function progressFraction(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}
