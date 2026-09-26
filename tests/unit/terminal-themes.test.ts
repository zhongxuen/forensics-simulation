import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TERMINAL_COLOR_KEYS,
  TerminalStyleOptionSchema,
  TerminalThemeSchema,
} from "@/content/schemas/theme";
import {
  CURSOR_STYLE_IDS,
  CURSOR_STYLES,
  DEFAULT_TERMINAL_THEME,
  PROMPT_STYLE_IDS,
  PROMPT_STYLES,
  TERMINAL_THEME_IDS,
  TERMINAL_THEME_LIST,
  TERMINAL_THEMES,
} from "@/content/themes";
import { findBannedWords } from "@/content/voice";
import { TerminalPreview } from "@/features/terminal";
import {
  auditContrast,
  CONTRAST_THEMES,
  formatContrastRatio,
  TERMINAL_CONTRAST_GROUPS,
  themeTokens,
} from "@/lib/contrast-audit";
import { customPropertiesIn } from "@/lib/css-custom-properties";
import { terminalThemeCss, terminalThemeTokens, tokenFor } from "@/lib/terminal-themes";

/**
 * Terminal themes (md-files/08-campaign-and-story.md, prompt 08.4): every colour theme passes the
 * phase 02 contrast audit for the terminal, the default theme is exactly the app's own terminal
 * palette, and the generated CSS carries every theme.
 */

const tokensCss = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");
// The terminal's frame is always dark (data-theme="dark"), so it's measured on the dark tokens.
const appTokens = themeTokens(tokensCss, CONTRAST_THEMES[0]!);

describe.each(TERMINAL_THEME_LIST.map((theme) => [theme.id, theme] as const))(
  "terminal theme %s",
  (_id, theme) => {
    it("validates", () => {
      expect(TerminalThemeSchema.safeParse(theme).success).toBe(true);
    });

    it("passes the terminal contrast audit (WCAG AA)", () => {
      // The app's tokens, with this theme's terminal colours in place: the focus ring is the app's.
      const tokens = new Map([...appTokens, ...terminalThemeTokens(theme)]);
      const failures = auditContrast(tokens, TERMINAL_CONTRAST_GROUPS)
        .flatMap((group) => group.rows)
        .filter((row) => !row.passes)
        .map(
          (row) =>
            `--${row.foreground} on --${row.background}: ` +
            (row.problem ?? `${formatContrastRatio(row.ratio ?? 0)}:1, needs ${row.minimum}:1`),
        );
      expect(failures).toEqual([]);
    });

    it("describes itself in plain words", () => {
      expect(findBannedWords(`${theme.name} ${theme.description}`)).toEqual([]);
    });
  },
);

describe("the terminal themes", () => {
  it("has at least four colour themes, each under its own id", () => {
    expect(TERMINAL_THEME_IDS.length).toBeGreaterThanOrEqual(4);
    for (const id of TERMINAL_THEME_IDS) expect(TERMINAL_THEMES[id].id).toBe(id);
  });

  it("makes the default theme exactly the app's terminal tokens", () => {
    const theme = TERMINAL_THEMES[DEFAULT_TERMINAL_THEME];
    for (const key of TERMINAL_COLOR_KEYS) {
      expect(theme.colors[key], key).toBe(appTokens.get(tokenFor(key)));
    }
  });

  it("sets every terminal token the app defines, and only those", () => {
    const appTerminalTokens = [...appTokens.keys()].filter((name) => name.startsWith("term-"));
    expect(TERMINAL_COLOR_KEYS.map(tokenFor).sort()).toEqual(appTerminalTokens.sort());
  });

  it("turns every theme into one CSS rule", () => {
    const css = terminalThemeCss();
    for (const theme of TERMINAL_THEME_LIST) {
      const rule = new RegExp(`\\[data-terminal-theme="${theme.id}"\\]\\{([^}]*)\\}`).exec(css);
      expect(rule, theme.id).not.toBeNull();
      const properties = customPropertiesIn(`x{${rule?.[1]}}`, "x");
      expect(properties).toEqual(terminalThemeTokens(theme));
    }
  });

  it("previews any theme, prompt and cursor with the terminal's own pieces", () => {
    const html = renderToStaticMarkup(
      createElement(TerminalPreview, { theme: "amber", promptStyle: "short", cursorStyle: "bar" }),
    );
    expect(html).toContain('data-terminal-theme="amber"');
    expect(html).toContain("Preview: the Amber colours, the Folder only prompt and a Bar cursor.");
    // The short prompt shows the folder, not user@host.
    expect(html).not.toContain("recruit@range-ws-01");
    expect(html).toContain('<span class="font-bold text-term-blue">~</span>');
    expect(html).toContain("after:w-0.5");

    const classic = renderToStaticMarkup(
      createElement(TerminalPreview, {
        theme: "candlewright",
        promptStyle: "classic",
        cursorStyle: "block",
      }),
    );
    expect(classic).toContain("recruit@range-ws-01");
    expect(classic).toContain("bg-term-cursor text-term-bg");
  });

  it("offers prompt and cursor styles, described in plain words", () => {
    expect(PROMPT_STYLE_IDS.length).toBeGreaterThanOrEqual(2);
    expect(CURSOR_STYLE_IDS.length).toBeGreaterThanOrEqual(2);
    for (const option of [...Object.values(PROMPT_STYLES), ...Object.values(CURSOR_STYLES)]) {
      expect(findBannedWords(`${option.name} ${option.description}`)).toEqual([]);
    }
  });

  // The theme module doesn't parse its data when it loads (it runs in the browser on every page,
  // and full Zod would add ~90 KB there), so this is where every style meets the schema.
  it("validates every prompt and cursor style, each under its own id", () => {
    for (const [id, option] of [
      ...Object.entries(PROMPT_STYLES),
      ...Object.entries(CURSOR_STYLES),
    ]) {
      expect(TerminalStyleOptionSchema.safeParse(option).success, id).toBe(true);
      expect(option.id).toBe(id);
    }
    for (const [id, theme] of Object.entries(TERMINAL_THEMES)) expect(theme.id).toBe(id);
  });
});
