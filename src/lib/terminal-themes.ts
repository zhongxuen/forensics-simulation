import { TERMINAL_COLOR_KEYS, type TerminalTheme } from "@/content/schemas/theme";
import { TERMINAL_THEME_LIST } from "@/content/themes";

/**
 * Terminal colour themes as CSS (md-files/08-campaign-and-story.md, prompt 08.4).
 *
 * The terminal draws every colour from the --term-* tokens (src/styles/tokens.css), which Tailwind
 * reads with `@theme inline`, so reassigning them on an element re-themes everything inside it. A
 * theme is one rule, `[data-terminal-theme="phosphor"] { --term-bg: …; … }`: the settings module
 * puts the attribute on <html> for the learner's choice, and the settings picker's previews put it
 * on their own boxes to show other themes.
 *
 * The CSS is built from the theme data and rendered once by the root layout
 * (TerminalThemeStyles in src/components/shell), so colour values live only in src/content/themes,
 * where tests/unit/terminal-themes.test.ts audits them.
 */

export const TERMINAL_THEME_ATTRIBUTE = "data-terminal-theme";

/** The design token each theme colour sets, without the dashes: `bg` → `term-bg`. */
export const tokenFor = (key: (typeof TERMINAL_COLOR_KEYS)[number]): string => `term-${key}`;

/** A theme's colours as design tokens (names without the dashes), as the contrast audit reads them. */
export function terminalThemeTokens(theme: TerminalTheme): Map<string, string> {
  return new Map(TERMINAL_COLOR_KEYS.map((key) => [tokenFor(key), theme.colors[key]]));
}

/** One CSS rule per theme. Every value is a validated 6-digit hex colour, so nothing can escape. */
export function terminalThemeCss(themes: readonly TerminalTheme[] = TERMINAL_THEME_LIST): string {
  return themes
    .map((theme) => {
      const declarations = TERMINAL_COLOR_KEYS.map(
        (key) => `--${tokenFor(key)}:${theme.colors[key]}`,
      ).join(";");
      return `[${TERMINAL_THEME_ATTRIBUTE}="${theme.id}"]{${declarations}}`;
    })
    .join("\n");
}
