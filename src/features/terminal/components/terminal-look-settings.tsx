"use client";

import {
  RadioGroup,
  SettingCard,
  useChangeSettings,
  type RadioOption,
} from "@/components/settings/controls";
import {
  CURSOR_STYLE_IDS,
  CURSOR_STYLES,
  PROMPT_STYLE_IDS,
  PROMPT_STYLES,
  TERMINAL_THEME_IDS,
  TERMINAL_THEMES,
  type CursorStyleId,
  type PromptStyleId,
  type TerminalThemeId,
} from "@/content/themes";
import { cx } from "@/lib/cx";
import { useSettings } from "@/lib/settings";
import { TerminalPreview } from "./terminal-preview";

const SWATCHES = [
  "bg-term-fg",
  "bg-term-green",
  "bg-term-blue",
  "bg-term-cyan",
  "bg-term-yellow",
  "bg-term-red",
  "bg-term-magenta",
] as const;

/** A theme's colours as a row of small squares, drawn from the theme itself. Decorative. */
function ThemeSwatches({ theme }: { theme: TerminalThemeId }) {
  return (
    <span
      aria-hidden="true"
      data-terminal-theme={theme}
      className="mt-3 flex w-fit gap-1 rounded-md border border-subtle bg-term-bg p-1.5"
    >
      {SWATCHES.map((swatch) => (
        <span key={swatch} className={cx("size-3 rounded-xs", swatch)} />
      ))}
    </span>
  );
}

const THEME_OPTIONS: ReadonlyArray<RadioOption<TerminalThemeId>> = TERMINAL_THEME_IDS.map((id) => ({
  value: id,
  label: TERMINAL_THEMES[id].name,
  detail: TERMINAL_THEMES[id].description,
  sample: <ThemeSwatches theme={id} />,
}));

const PROMPT_OPTIONS: ReadonlyArray<RadioOption<PromptStyleId>> = PROMPT_STYLE_IDS.map((id) => ({
  value: id,
  label: PROMPT_STYLES[id].name,
  detail: PROMPT_STYLES[id].description.replace(/`/g, ""),
}));

const CURSOR_OPTIONS: ReadonlyArray<RadioOption<CursorStyleId>> = CURSOR_STYLE_IDS.map((id) => ({
  value: id,
  label: CURSOR_STYLES[id].name,
  detail: CURSOR_STYLES[id].description,
}));

/**
 * The terminal's look on /settings (md-files/08-campaign-and-story.md, prompt 08.4): colour theme,
 * prompt style and cursor style, with a live preview drawn by the terminal's own pieces. Every
 * choice is free and there from the start, saved through the phase 03 settings module, and none
 * changes difficulty, content or hints.
 */
export function TerminalLookSettings() {
  const settings = useSettings();
  const change = useChangeSettings();

  return (
    <SettingCard
      title="Terminal look"
      description="Colours, prompt and cursor for every terminal in the app. They're all free, and none of them changes a mission."
    >
      <div className="space-y-6">
        <RadioGroup
          legend="Colours"
          value={settings.terminalTheme}
          options={THEME_OPTIONS}
          onChange={(value) => change({ terminalTheme: value })}
        />
        <RadioGroup
          legend="Prompt: what shows before you type"
          value={settings.promptStyle}
          options={PROMPT_OPTIONS}
          onChange={(value) => change({ promptStyle: value })}
          columns={2}
        />
        <RadioGroup
          legend="Cursor"
          value={settings.cursorStyle}
          options={CURSOR_OPTIONS}
          onChange={(value) => change({ cursorStyle: value })}
        />
        <div>
          <p className="mb-2 font-medium text-primary">How it looks</p>
          <TerminalPreview
            theme={settings.terminalTheme}
            promptStyle={settings.promptStyle}
            cursorStyle={settings.cursorStyle}
          />
        </div>
      </div>
    </SettingCard>
  );
}
