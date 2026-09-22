/**
 * Visible keyboard focus for every interactive element. The offset leaves a gap, so the ring sits
 * on the surface (audited at 3:1 in src/lib/contrast-audit.ts) and stays readable against
 * accent-filled controls.
 */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
