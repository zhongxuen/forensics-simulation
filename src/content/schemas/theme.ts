import { z } from "zod";
import { ContentIdSchema } from "./ids";

/**
 * Terminal looks (md-files/08-campaign-and-story.md, "Terminal themes" and prompt 08.4): colour
 * themes, prompt styles and cursor styles. All of them are free and open from the start, picked on
 * /settings. They change how the terminal looks, never what a mission asks, how hard it is, or
 * what a hint says.
 *
 * Every colour theme must pass the same WCAG AA checks as the app's own terminal palette
 * (tests/unit/terminal-themes.test.ts runs the phase 02 contrast audit over each one).
 */

/**
 * The colours a theme sets, one per `--term-*` token in src/styles/tokens.css, plus the cursor.
 * `black` is ANSI black, a background colour: the terminal shows black text as bright black.
 */
export const TERMINAL_COLOR_KEYS = [
  "bg",
  "fg",
  "dim",
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "bright-black",
  "bright-red",
  "bright-green",
  "bright-yellow",
  "bright-blue",
  "bright-magenta",
  "bright-cyan",
  "bright-white",
  "cursor",
] as const;

export type TerminalColorKey = (typeof TERMINAL_COLOR_KEYS)[number];

/** An opaque 6-digit hex colour, the only form the contrast audit measures. */
const HexColourSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Write the colour as a 6-digit hex value, like "#0b0f14".');

export const TerminalThemeSchema = z.strictObject({
  id: ContentIdSchema,
  /** Shown on the picker. */
  name: z.string().trim().min(1).max(30),
  /** One plain line on what it looks like. */
  description: z.string().trim().min(1).max(120),
  colors: z.strictObject(
    Object.fromEntries(TERMINAL_COLOR_KEYS.map((key) => [key, HexColourSchema])) as Record<
      TerminalColorKey,
      typeof HexColourSchema
    >,
  ),
});

export type TerminalTheme = z.output<typeof TerminalThemeSchema>;

/** A prompt style or cursor style: a choice shown on the picker, drawn by the terminal. */
export const TerminalStyleOptionSchema = z.strictObject({
  id: ContentIdSchema,
  name: z.string().trim().min(1).max(30),
  description: z.string().trim().min(1).max(120),
});

export type TerminalStyleOption = z.output<typeof TerminalStyleOptionSchema>;
