// zod/mini, not zod: this schema runs in the browser on every page, and the full Zod build adds
// about 90 KB (gzipped) that can't be tree-shaken (md-files/11-testing-security-deployment.md,
// prompt 11.3). Mini is the same validator with a smaller, function-style API.
import * as z from "zod/mini";
import {
  CURSOR_STYLE_IDS,
  DEFAULT_CURSOR_STYLE,
  DEFAULT_PROMPT_STYLE,
  DEFAULT_TERMINAL_THEME,
  PROMPT_STYLE_IDS,
  TERMINAL_THEME_IDS,
} from "@/content/themes";

/**
 * The learner's settings: the only thing the app remembers between visits
 * (md-files/03-app-state-and-privacy.md). Settings change how the app looks and behaves, never
 * what a learner has done: no mission data, scores or progress ever go in here.
 *
 * To add a setting (phase 05 beginner mode, 07 graph/table view, 08 terminal theme, 10 nudge
 * chip, 11 usage counts), add one field below wrapped in `z.catch(schema, default)`. Nothing else
 * changes: reads validate each field on its own, so a value saved by an older version, or edited
 * by hand, falls back to its default without touching the others. If the setting has to show
 * before first paint, also teach the boot script (boot-script.ts) to apply it.
 */
const ReducedMotionOverrideSchema = z.enum(["system", "reduce", "full"]);
const NetworkViewSchema = z.enum(["graph", "table"]);

export const SETTINGS_SHAPE = {
  /** The desktop sidebar is collapsed to an icon rail. */
  sidebarCollapsed: z.catch(z.boolean(), false),
  /**
   * Decorative motion: "system" follows the device's reduce-motion setting, "reduce" turns it off,
   * "full" keeps it on even when the device asks for less. Applied as data-motion on <html>
   * (src/styles/motion.css).
   */
  reducedMotionOverride: z.catch(ReducedMotionOverrideSchema, "system"),
  /**
   * Beginner mode (phase 05): the terminal's plain-language explainer lines under errors, and its
   * row of suggested commands. On by default, because most learners are brand new.
   */
  beginnerMode: z.catch(z.boolean(), true),
  /**
   * How the network map shows what you've found (phase 07): the drawing ("graph") or the table,
   * which says everything the drawing does in rows and columns.
   */
  networkView: z.catch(NetworkViewSchema, "graph"),
  /**
   * The terminal's colours, prompt and cursor (phase 08, src/content/themes). All free, all there
   * from the start, and none changes difficulty, content or hints. The colour theme is applied as
   * data-terminal-theme on <html> (src/lib/terminal-themes.ts).
   */
  terminalTheme: z.catch(z.enum(TERMINAL_THEME_IDS), DEFAULT_TERMINAL_THEME),
  promptStyle: z.catch(z.enum(PROMPT_STYLE_IDS), DEFAULT_PROMPT_STYLE),
  cursorStyle: z.catch(z.enum(CURSOR_STYLE_IDS), DEFAULT_CURSOR_STYLE),
  /**
   * The mentor's "Want a nudge?" chip (phase 10): a small offer of a hint when the learner seems
   * stuck in a mission. It never opens anything by itself. On by default; off hides it for good.
   */
  nudgeChip: z.catch(z.boolean(), true),
  /**
   * Anonymous usage counts (phase 11, src/lib/analytics): counts like "a mission was started" or
   * "an objective was ticked", with nothing that identifies anyone, used to find the parts of a
   * mission that are too hard. On by default; off sends nothing at all. A browser that asks sites
   * not to track it (Do Not Track, Global Privacy Control) sends nothing either way.
   */
  usageCounts: z.catch(z.boolean(), true),
} as const;

export const SettingsSchema = z.object(SETTINGS_SHAPE);

export type Settings = z.output<typeof SettingsSchema>;

export type ReducedMotionOverride = Settings["reducedMotionOverride"];

export const REDUCED_MOTION_OVERRIDES: readonly ReducedMotionOverride[] =
  ReducedMotionOverrideSchema.options;

export type NetworkView = Settings["networkView"];

export const NETWORK_VIEWS: readonly NetworkView[] = NetworkViewSchema.options;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze(SettingsSchema.parse({}));

/**
 * Settings from anything: parsed JSON, a partial update, or garbage. Each known field is validated
 * on its own and falls back to its default; unknown keys are dropped. Never throws.
 */
export function parseSettings(raw: unknown): Readonly<Settings> {
  const input: Record<string, unknown> =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  // z.object strips unknown keys, and each field's z.catch() replaces a bad value with its default.
  return Object.freeze(SettingsSchema.parse(input));
}

/** Whether two settings objects hold the same values. */
export function sameSettings(a: Readonly<Settings>, b: Readonly<Settings>): boolean {
  return (Object.keys(SETTINGS_SHAPE) as (keyof Settings)[]).every((key) => a[key] === b[key]);
}
