/**
 * WCAG 2.x contrast ratio, with no dependencies.
 *
 * Used by the /styleguide contrast audit (md-files/02-design-system-and-app-shell.md): every text
 * token pair must be measured, not eyeballed.
 *
 * Colours must be opaque. The contrast of a translucent colour depends on what is behind it, so
 * `#rrggbbaa` is rejected rather than silently measured against an assumed backdrop.
 */

/** An opaque sRGB colour, each channel an integer from 0 to 255. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** A colour as a `#rgb` / `#rrggbb` hex string, or as channels. */
export type Color = string | Rgb;

/** Text size as WCAG defines it: "large" is at least 24px, or at least 18.66px bold. */
export type TextSize = "normal" | "large";

/** Minimum AA ratios. Large text and UI component boundaries share the 3:1 floor. */
export const WCAG_AA_MIN_RATIO: Readonly<Record<TextSize, number>> = {
  normal: 4.5,
  large: 3,
};

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parse `#rgb` or `#rrggbb` (case-insensitive). Throws on anything else. */
export function parseHexColor(hex: string): Rgb {
  if (!HEX_PATTERN.test(hex)) {
    const hint = /^#(?:[0-9a-f]{4}|[0-9a-f]{8})$/i.test(hex)
      ? " Colours with alpha have no fixed contrast; measure the colour it blends to instead."
      : "";
    throw new Error(`Expected an opaque hex colour like #0b0f14 or #fff, got "${hex}".${hint}`);
  }

  const digits = hex.slice(1);
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function toRgb(color: Color): Rgb {
  if (typeof color === "string") return parseHexColor(color);

  for (const channel of [color.r, color.g, color.b]) {
    if (!Number.isInteger(channel) || channel < 0 || channel > 255) {
      throw new Error(`Colour channels must be integers from 0 to 255, got ${channel}.`);
    }
  }
  return color;
}

/** sRGB channel (0–255) to linear light (0–1). */
function linearize(channel: number): number {
  const c = channel / 255;
  // WCAG 2.x prints 0.03928; 0.04045 is the sRGB standard's value. No 8-bit channel falls between
  // the two, so the result is identical.
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance: 0 for black, 1 for white. */
export function relativeLuminance(color: Color): number {
  const { r, g, b } = toRgb(color);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * WCAG contrast ratio between two colours, from 1 (identical) to 21 (black on white).
 * Symmetric: the order of foreground and background does not matter.
 *
 * The result is unrounded. WCAG forbids rounding up, so compare it directly against a threshold
 * (4.499 fails 4.5) and round only for display.
 */
export function contrastRatio(a: Color, b: Color): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Whether a contrast ratio meets WCAG AA for the given text size. */
export function meetsWcagAA(ratio: number, size: TextSize = "normal"): boolean {
  return ratio >= WCAG_AA_MIN_RATIO[size];
}
