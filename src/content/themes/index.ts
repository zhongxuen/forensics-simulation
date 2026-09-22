// Types only: this module runs in the browser on every page (the settings read its ids), so it
// doesn't bring the Zod schema along (md-files/11-testing-security-deployment.md, prompt 11.3).
// tests/unit/terminal-themes.test.ts validates every theme and style against the schema instead.
import type { TerminalStyleOption, TerminalTheme } from "../schemas/theme";

/**
 * The terminal's looks, as data (md-files/08-campaign-and-story.md, prompt 08.4). Every one is
 * free and available from the start. None changes difficulty, content or hints.
 *
 * - Colour themes: all dark, so the app's keyboard focus ring stays visible on every one. The
 *   default, "Candlewright", is the app's own terminal palette from src/styles/tokens.css
 *   (tests/unit/terminal-themes.test.ts checks they match, and runs the contrast audit over all).
 * - Prompt styles: how much the prompt shows before what you type.
 * - Cursor styles: the shape of the cursor at the prompt.
 *
 * Adding one is a new entry here with a new id. The settings picker and the generated theme CSS
 * (src/lib/terminal-themes.ts) pick it up on their own.
 */

export const TERMINAL_THEME_IDS = [
  "candlewright",
  "phosphor",
  "amber",
  "deep-sea",
  "high-contrast",
] as const;

export type TerminalThemeId = (typeof TERMINAL_THEME_IDS)[number];

export const DEFAULT_TERMINAL_THEME: TerminalThemeId = "candlewright";

/** Types a theme here; its colours and words are checked against the schema by the tests. */
const theme = (value: TerminalTheme): TerminalTheme => value;

export const TERMINAL_THEMES: Readonly<Record<TerminalThemeId, TerminalTheme>> = {
  candlewright: theme({
    id: "candlewright",
    name: "Candlewright",
    description: "The team's own look: soft white on near-black, with a cyan cursor.",
    colors: {
      bg: "#080b10",
      fg: "#d6e2ee",
      dim: "#8593a5",
      black: "#2b3340",
      red: "#ff6e6e",
      green: "#4ade80",
      yellow: "#f5c451",
      blue: "#6aa8ff",
      magenta: "#e08aff",
      cyan: "#3dd6ef",
      white: "#c9d4df",
      "bright-black": "#7d8b9c",
      "bright-red": "#ff9a9a",
      "bright-green": "#86efac",
      "bright-yellow": "#fde68a",
      "bright-blue": "#9cc5ff",
      "bright-magenta": "#f0b5ff",
      "bright-cyan": "#8beeff",
      "bright-white": "#f5f8fb",
      cursor: "#3dd6ef",
    },
  }),
  phosphor: theme({
    id: "phosphor",
    name: "Phosphor",
    description: "Green on black, like the glowing screens of old computer terminals.",
    colors: {
      bg: "#030a05",
      fg: "#7df0a0",
      dim: "#56a56f",
      black: "#13301d",
      red: "#ff8a7a",
      green: "#5bf08a",
      yellow: "#d8f07a",
      blue: "#7ab8ff",
      magenta: "#d99aff",
      cyan: "#5ee8d0",
      white: "#b8f5c8",
      "bright-black": "#62a577",
      "bright-red": "#ffb0a5",
      "bright-green": "#9dffb9",
      "bright-yellow": "#efffa8",
      "bright-blue": "#a8d0ff",
      "bright-magenta": "#ecc2ff",
      "bright-cyan": "#9ff7e6",
      "bright-white": "#e8fff0",
      cursor: "#5bf08a",
    },
  }),
  amber: theme({
    id: "amber",
    name: "Amber",
    description: "Warm gold on dark brown, gentle on the eyes late at night.",
    colors: {
      bg: "#0d0904",
      fg: "#ffc46b",
      dim: "#b58a50",
      black: "#3a2a14",
      red: "#ff8266",
      green: "#b5d96a",
      yellow: "#ffd24d",
      blue: "#8fb3ff",
      magenta: "#f09ad0",
      cyan: "#6fd6c6",
      white: "#f0d6ad",
      "bright-black": "#a8814f",
      "bright-red": "#ffab98",
      "bright-green": "#d2ef93",
      "bright-yellow": "#ffe48f",
      "bright-blue": "#b8ceff",
      "bright-magenta": "#f8c0e2",
      "bright-cyan": "#a2eade",
      "bright-white": "#fff3e0",
      cursor: "#ffb640",
    },
  }),
  "deep-sea": theme({
    id: "deep-sea",
    name: "Deep sea",
    description: "Cool blues on a dark navy background.",
    colors: {
      bg: "#06101c",
      fg: "#cfe3f7",
      dim: "#8199b4",
      black: "#1a2c42",
      red: "#ff7b8a",
      green: "#56e0a0",
      yellow: "#f2cc60",
      blue: "#5fb0ff",
      magenta: "#c79bff",
      cyan: "#45d3e6",
      white: "#bfd3e6",
      "bright-black": "#7a92ac",
      "bright-red": "#ffa3ad",
      "bright-green": "#8ff0c2",
      "bright-yellow": "#f9e19a",
      "bright-blue": "#95cbff",
      "bright-magenta": "#dcc0ff",
      "bright-cyan": "#86e7f3",
      "bright-white": "#f0f7ff",
      cursor: "#5fb0ff",
    },
  }),
  "high-contrast": theme({
    id: "high-contrast",
    name: "High contrast",
    description: "Pure white on pure black, with the brightest colours. The easiest to read.",
    colors: {
      bg: "#000000",
      fg: "#ffffff",
      dim: "#b3b3b3",
      black: "#333333",
      red: "#ff8080",
      green: "#5cff8a",
      yellow: "#ffe14d",
      blue: "#8cb8ff",
      magenta: "#ff9cff",
      cyan: "#5cf2ff",
      white: "#e6e6e6",
      "bright-black": "#a6a6a6",
      "bright-red": "#ffb3b3",
      "bright-green": "#a3ffbd",
      "bright-yellow": "#fff0a3",
      "bright-blue": "#bdd6ff",
      "bright-magenta": "#ffc9ff",
      "bright-cyan": "#a8f8ff",
      "bright-white": "#ffffff",
      cursor: "#ffe14d",
    },
  }),
};

export const TERMINAL_THEME_LIST: readonly TerminalTheme[] = TERMINAL_THEME_IDS.map(
  (id) => TERMINAL_THEMES[id],
);

// ---------------------------------------------------------------------------------------------
// Prompt styles
// ---------------------------------------------------------------------------------------------

export const PROMPT_STYLE_IDS = ["classic", "short", "arrow", "minimal"] as const;

export type PromptStyleId = (typeof PROMPT_STYLE_IDS)[number];

export const DEFAULT_PROMPT_STYLE: PromptStyleId = "classic";

/** Types a prompt or cursor style; the tests check it against the schema. */
const option = (value: TerminalStyleOption): TerminalStyleOption => value;

export const PROMPT_STYLES: Readonly<Record<PromptStyleId, TerminalStyleOption>> = {
  classic: option({
    id: "classic",
    name: "Full",
    description: "Who you are, which computer, and which folder, like a real Linux terminal.",
  }),
  short: option({
    id: "short",
    name: "Folder only",
    description: "Only the folder you're in, so lines stay short.",
  }),
  arrow: option({
    id: "arrow",
    name: "Arrow",
    description: "The folder after an arrow, a style many programmers use.",
  }),
  minimal: option({
    id: "minimal",
    name: "Minimal",
    description: "Only the $ sign. Type `pwd` whenever you want to know where you are.",
  }),
};

// ---------------------------------------------------------------------------------------------
// Cursor styles
// ---------------------------------------------------------------------------------------------

export const CURSOR_STYLE_IDS = ["block", "underline", "bar"] as const;

export type CursorStyleId = (typeof CURSOR_STYLE_IDS)[number];

export const DEFAULT_CURSOR_STYLE: CursorStyleId = "block";

export const CURSOR_STYLES: Readonly<Record<CursorStyleId, TerminalStyleOption>> = {
  block: option({
    id: "block",
    name: "Block",
    description: "A solid box over the next letter. The easiest to spot.",
  }),
  underline: option({
    id: "underline",
    name: "Underline",
    description: "A line under the next letter.",
  }),
  bar: option({
    id: "bar",
    name: "Bar",
    description: "A thin line before the next letter, like in a text box.",
  }),
};
