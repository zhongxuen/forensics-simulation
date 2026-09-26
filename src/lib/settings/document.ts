import { DEFAULT_TERMINAL_THEME } from "@/content/themes";
import type { AppTheme, Settings } from "./schema";

/** The media query "system" follows. The boot script uses the same string. */
export const PREFERS_LIGHT_QUERY = "(prefers-color-scheme: light)";

/** Which theme shows: "system" becomes whatever the device prefers. */
export function resolveAppTheme(appTheme: AppTheme, prefersLight: boolean): "dark" | "light" {
  return appTheme === "system" ? (prefersLight ? "light" : "dark") : appTheme;
}

/**
 * Puts the settings that change the page's look onto <html>, where CSS reads them:
 * data-sidebar="collapsed" for the `rail:` variant (src/styles/globals.css),
 * data-motion="reduce" | "full" for --motion-scale (src/styles/motion.css),
 * data-terminal-theme for the terminal's colours (src/lib/terminal-themes.ts), and
 * data-theme="light" for Daylight (src/styles/tokens.css). A default value removes its attribute:
 * "system" motion lets the device's own setting decide, the default terminal theme is the plain
 * --term-* tokens, and dark is :root's own tokens. `prefersLight` is the device's colour scheme,
 * which the "system" app theme follows.
 *
 * The boot script (boot-script.ts) does the same before first paint and must stay in step with
 * this: tests/unit/settings-boot-script.test.ts checks that they agree.
 */
export function applySettingsToElement(
  root: Pick<HTMLElement, "dataset">,
  settings: Readonly<Settings>,
  prefersLight = false,
): void {
  if (settings.sidebarCollapsed) root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;

  if (settings.reducedMotionOverride === "system") delete root.dataset.motion;
  else root.dataset.motion = settings.reducedMotionOverride;

  if (settings.terminalTheme === DEFAULT_TERMINAL_THEME) delete root.dataset.terminalTheme;
  else root.dataset.terminalTheme = settings.terminalTheme;

  if (resolveAppTheme(settings.appTheme, prefersLight) === "light") root.dataset.theme = "light";
  else delete root.dataset.theme;
}
