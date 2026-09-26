import { DEFAULT_TERMINAL_THEME, TERMINAL_THEME_IDS } from "@/content/themes";
import { PREFERS_LIGHT_QUERY } from "./document";
import { REDUCED_MOTION_OVERRIDES } from "./schema";
import { SETTINGS_STORAGE_KEY } from "./store";

const MOTION_ATTRIBUTE_VALUES = REDUCED_MOTION_OVERRIDES.filter((value) => value !== "system");
const THEME_ATTRIBUTE_VALUES = TERMINAL_THEME_IDS.filter((id) => id !== DEFAULT_TERMINAL_THEME);

/**
 * A tiny inline script that applies the saved settings to <html> before first paint, so a
 * collapsed sidebar never flashes open, reduced motion is on from the first frame, the page never
 * flashes dark before Daylight, and the terminal starts in the learner's colour theme. It does what applySettingsToElement (document.ts)
 * does, in plain ES5, and swallows every error: with blocked storage or bad JSON the page starts on
 * defaults.
 *
 * Render it once, at the top of <body> in the root layout (SettingsBootScript in
 * src/components/shell). Import it from this file rather than the settings index, so a server
 * component doesn't pull in the useSettings hook.
 */
export const SETTINGS_BOOT_SCRIPT = [
  "try{",
  `var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_STORAGE_KEY)}));`,
  "var r=document.documentElement;",
  'if(s&&s.sidebarCollapsed===true)r.dataset.sidebar="collapsed";',
  `if(s&&${JSON.stringify(MOTION_ATTRIBUTE_VALUES)}.indexOf(s.reducedMotionOverride)>=0)`,
  "r.dataset.motion=s.reducedMotionOverride;",
  `if(s&&${JSON.stringify(THEME_ATTRIBUTE_VALUES)}.indexOf(s.terminalTheme)>=0)`,
  "r.dataset.terminalTheme=s.terminalTheme;",
  'if(s&&(s.appTheme==="light"||s.appTheme==="system"&&',
  `window.matchMedia&&window.matchMedia(${JSON.stringify(PREFERS_LIGHT_QUERY)}).matches))`,
  'r.dataset.theme="light"',
  "}catch(e){}",
].join("");
