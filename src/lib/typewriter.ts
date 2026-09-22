/**
 * Timing for the typewriter effect in story and mentor messages
 * (src/components/ui/character-message.tsx).
 *
 * Short lines type at a steady pace; long ones speed up, so no message takes longer than
 * TYPEWRITER_MAX_MS to finish. Reading time matters more than the effect.
 */

/** The longest any message takes to type out, matching the 1.5s cap on celebrations. */
export const TYPEWRITER_MAX_MS = 1500;

/** The pace for short lines, in milliseconds per character. */
export const TYPEWRITER_CHAR_MS = 28;

/** How long a message of `length` characters takes to type out, in milliseconds. */
export function typewriterDurationMs(length: number): number {
  if (!Number.isFinite(length) || length <= 0) return 0;
  return Math.min(TYPEWRITER_MAX_MS, length * TYPEWRITER_CHAR_MS);
}

/** How many of `length` characters show after `elapsedMs` of typing. */
export function charactersRevealed(elapsedMs: number, length: number): number {
  const duration = typewriterDurationMs(length);
  if (duration === 0 || elapsedMs >= duration) return Math.max(0, Math.floor(length));
  if (!(elapsedMs > 0)) return 0;
  return Math.floor((elapsedMs / duration) * length);
}
