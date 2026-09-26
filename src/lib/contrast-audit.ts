/**
 * The contrast audit behind /styleguide and tests/unit/contrast-audit.test.ts: which colour tokens
 * are measured against which, and the WCAG AA minimum each pair must meet.
 *
 * Contrast is a hard gate (md-files/02-design-system-and-app-shell.md). The test fails if any pair
 * below falls short, in either app theme (CONTRAST_THEMES), and if a colour token in tokens.css is
 * neither audited nor excluded with a reason, so a new token can't skip the check.
 */

import { contrastRatio, WCAG_AA_MIN_RATIO } from "@/lib/contrast";
import { customPropertiesIn } from "@/lib/css-custom-properties";

/** An app theme: the tokens.css blocks that declare it, later blocks overriding earlier ones. */
export interface ContrastTheme {
  readonly id: "dark" | "light";
  readonly title: string;
  readonly blocks: readonly string[];
}

const DARK_BLOCKS = [':root, [data-theme="dark"]', ":root"] as const;

/**
 * Both app themes (UIUX.md §3). Daylight only reassigns names, so it's measured as Lamplight with
 * its block laid on top, exactly as the cascade builds it on <html>. The terminal tokens come
 * through unchanged, because the terminal stays dark in both.
 */
export const CONTRAST_THEMES: readonly ContrastTheme[] = [
  { id: "dark", title: "Lamplight (dark)", blocks: DARK_BLOCKS },
  { id: "light", title: "Daylight (light)", blocks: [...DARK_BLOCKS, '[data-theme="light"]'] },
];

/** The token values a theme resolves to on <html>, from the source text of tokens.css. */
export function themeTokens(css: string, theme: ContrastTheme): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const block of theme.blocks) {
    for (const [name, value] of customPropertiesIn(css, block)) tokens.set(name, value);
  }
  return tokens;
}

/** What a pair is used for, which sets its minimum ratio. */
export type ContrastUse = "text" | "non-text";

/**
 * Text is held to the 4.5:1 body-text minimum at every size, so no token is only safe when large.
 * Non-text contrast (WCAG 1.4.11: control boundaries, focus rings, meaningful fills) needs 3:1.
 */
export const CONTRAST_MINIMUM: Readonly<Record<ContrastUse, number>> = {
  text: WCAG_AA_MIN_RATIO.normal,
  "non-text": WCAG_AA_MIN_RATIO.large,
};

export interface ContrastAuditGroupSpec {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly use: ContrastUse;
  /** Token names without the dashes: `text-primary` for `--text-primary`. */
  readonly foregrounds: readonly string[];
  readonly backgrounds: readonly string[];
}

/** Every surface that text and controls sit on. The current nav item sits on --accent-subtle. */
const SURFACES = ["surface-base", "surface-raised", "surface-overlay", "accent-subtle"] as const;

const SOLID_FILLS = [
  "accent",
  "accent-hover",
  "status-success",
  "status-warning",
  "status-danger",
  "status-info",
  "reward",
] as const;

export const CONTRAST_AUDIT_GROUPS: readonly ContrastAuditGroupSpec[] = [
  {
    id: "text-on-surfaces",
    title: "Text on surfaces",
    description:
      "Every colour used for text, on every surface. Status and reward colours count as text because labels and messages use them.",
    use: "text",
    foregrounds: [
      "text-primary",
      "text-secondary",
      "text-muted",
      "accent",
      "accent-hover",
      "status-success",
      "status-warning",
      "status-danger",
      "status-info",
      "reward",
    ],
    backgrounds: SURFACES,
  },
  {
    id: "text-on-fills",
    title: "Text on solid fills",
    description:
      "Text on a solid colour fill uses --surface-base: the Start here button, primary buttons, and solid status or reward badges.",
    use: "text",
    foregrounds: ["surface-base"],
    backgrounds: SOLID_FILLS,
  },
  {
    id: "terminal-text",
    title: "Terminal text",
    description:
      "The terminal palette on the terminal background, which is the only surface the terminal renderer (phase 05) draws it on.",
    use: "text",
    foregrounds: [
      "term-fg",
      "term-dim",
      "term-red",
      "term-green",
      "term-yellow",
      "term-blue",
      "term-magenta",
      "term-cyan",
      "term-white",
      "term-bright-black",
      "term-bright-red",
      "term-bright-green",
      "term-bright-yellow",
      "term-bright-blue",
      "term-bright-magenta",
      "term-bright-cyan",
      "term-bright-white",
    ],
    backgrounds: ["term-bg"],
  },
  {
    id: "terminal-cursor",
    title: "Terminal cursor and focus",
    description:
      "The prompt's cursor, and the keyboard focus ring on anything inside the terminal, need 3:1 against the terminal background.",
    use: "non-text",
    foregrounds: ["term-cursor", "focus-ring"],
    backgrounds: ["term-bg"],
  },
  {
    id: "terminal-under-cursor",
    title: "Text under the cursor",
    description:
      "The block cursor covers the next letter, which shows in the terminal background colour on the cursor colour.",
    use: "text",
    foregrounds: ["term-bg"],
    backgrounds: ["term-cursor"],
  },
  {
    id: "non-text",
    title: "Borders, focus rings and indicators",
    description:
      "Non-text contrast needs 3:1 against the surface next to it: a border that marks out a control, the keyboard focus ring (drawn with a gap, so it sits on the surface, not the control), and fills that carry meaning, like the current-page bar and progress rings.",
    use: "non-text",
    foregrounds: ["border-strong", "focus-ring", "accent", "reward"],
    backgrounds: SURFACES,
  },
];

/**
 * The groups about the terminal alone: what every terminal colour theme (src/content/themes) must
 * pass, measured with the theme's colours in place of the default --term-* tokens.
 */
export const TERMINAL_CONTRAST_GROUPS: readonly ContrastAuditGroupSpec[] =
  CONTRAST_AUDIT_GROUPS.filter((group) => group.id.startsWith("terminal-"));

/** Colour tokens deliberately left out of the audit as foregrounds, and why. */
export const CONTRAST_AUDIT_EXCLUSIONS: Readonly<Record<string, string>> = {
  "border-subtle":
    "Decorative dividers only. WCAG asks for 3:1 only when a border is what shows you where a control is; use --border-strong for those.",
  "term-black":
    "ANSI black is a terminal background colour. It is too dark to read as text on --term-bg by design.",
  "reward-glow": "Translucent, for glows and shadows only, never text.",
};

export interface ContrastAuditRow {
  readonly foreground: string;
  readonly background: string;
  /** The declared values, or undefined when a token is missing from tokens.css. */
  readonly foregroundValue: string | undefined;
  readonly backgroundValue: string | undefined;
  /** Unrounded. Undefined when the pair couldn't be measured (see `problem`). */
  readonly ratio: number | undefined;
  readonly minimum: number;
  readonly passes: boolean;
  /** Why the pair couldn't be measured. A pair that can't be measured fails. */
  readonly problem: string | undefined;
}

export interface ContrastAuditGroup extends ContrastAuditGroupSpec {
  readonly rows: readonly ContrastAuditRow[];
}

function measure(
  foreground: string | undefined,
  background: string | undefined,
): { ratio: number; problem?: undefined } | { ratio?: undefined; problem: string } {
  if (foreground === undefined || background === undefined) {
    return { problem: "Token not defined in tokens.css." };
  }
  try {
    return { ratio: contrastRatio(foreground, background) };
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Measure every pair in `groups` using the token values in `tokens` (names without the dashes, as
 * returned by customPropertiesIn).
 */
export function auditContrast(
  tokens: ReadonlyMap<string, string>,
  groups: readonly ContrastAuditGroupSpec[] = CONTRAST_AUDIT_GROUPS,
): ContrastAuditGroup[] {
  return groups.map((group) => {
    const minimum = CONTRAST_MINIMUM[group.use];

    const rows = group.backgrounds.flatMap((background) =>
      group.foregrounds.map((foreground): ContrastAuditRow => {
        const foregroundValue = tokens.get(foreground);
        const backgroundValue = tokens.get(background);
        const { ratio, problem } = measure(foregroundValue, backgroundValue);
        return {
          foreground,
          background,
          foregroundValue,
          backgroundValue,
          ratio,
          minimum,
          // Compared unrounded, so 4.499 fails 4.5.
          passes: ratio !== undefined && ratio >= minimum,
          problem,
        };
      }),
    );

    return { ...group, rows };
  });
}

/**
 * A ratio for display, to two decimals, rounded down: WCAG never rounds a ratio up, so a failing
 * 4.497 must not read as 4.50.
 */
export function formatContrastRatio(ratio: number): string {
  return (Math.floor(ratio * 100) / 100).toFixed(2);
}
