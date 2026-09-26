import { describe, expect, it } from "vitest";
import { SETTINGS_BOOT_SCRIPT } from "@/lib/settings/boot-script";
import { applySettingsToElement, PREFERS_LIGHT_QUERY } from "@/lib/settings/document";
import { parseSettings } from "@/lib/settings/schema";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/store";

/**
 * The boot script applies saved settings before first paint; afterwards the settings module takes
 * over. If they disagreed, the page would flash between two layouts. Runs the real script against
 * a fake localStorage and <html>, and compares it with applySettingsToElement.
 */

type Dataset = Record<string, string>;

function runBootScript(
  getItem: (key: string) => string | null,
  prefersLight: boolean | undefined = false,
): Dataset {
  const dataset: Dataset = {};
  const localStorage = { getItem };
  const document = { documentElement: { dataset } };
  // undefined: a browser without matchMedia.
  const window =
    prefersLight === undefined
      ? {}
      : {
          matchMedia: (query: string) => ({
            matches: query === PREFERS_LIGHT_QUERY && prefersLight,
          }),
        };
  // The script is plain ES5 that reads the `localStorage`, `document` and `window` globals.
  new Function("localStorage", "document", "window", SETTINGS_BOOT_SCRIPT)(
    localStorage,
    document,
    window,
  );
  return dataset;
}

function expected(saved: string | null, prefersLight = false): Dataset {
  let raw: unknown;
  try {
    raw = saved === null ? undefined : JSON.parse(saved);
  } catch {
    raw = undefined;
  }
  const root = { dataset: {} as DOMStringMap };
  applySettingsToElement(root, parseSettings(raw), prefersLight);
  return { ...root.dataset } as Dataset;
}

const SAVED_VALUES: (string | null)[] = [
  null,
  "{}",
  JSON.stringify({ sidebarCollapsed: true }),
  JSON.stringify({ sidebarCollapsed: true, reducedMotionOverride: "reduce" }),
  JSON.stringify({ reducedMotionOverride: "full" }),
  JSON.stringify({ reducedMotionOverride: "system" }),
  JSON.stringify({ terminalTheme: "phosphor" }),
  JSON.stringify({ terminalTheme: "candlewright", sidebarCollapsed: true }),
  JSON.stringify({ terminalTheme: "neon-pink", reducedMotionOverride: "reduce" }),
  JSON.stringify({ terminalTheme: "toString" }),
  JSON.stringify({ appTheme: "light" }),
  JSON.stringify({ appTheme: "dark" }),
  JSON.stringify({ appTheme: "system" }),
  JSON.stringify({ appTheme: "light", terminalTheme: "phosphor", sidebarCollapsed: true }),
  JSON.stringify({ appTheme: "sepia" }),
  // Corrupt or hand-edited values.
  JSON.stringify({ sidebarCollapsed: "true", reducedMotionOverride: "sometimes" }),
  JSON.stringify({ reducedMotionOverride: "constructor" }),
  "null",
  "[]",
  '"collapsed"',
  "{not json",
];

describe("SETTINGS_BOOT_SCRIPT", () => {
  it.each(SAVED_VALUES)("agrees with the settings module for saved value %s", (saved) => {
    const dataset = runBootScript((key) => (key === SETTINGS_STORAGE_KEY ? saved : null));
    expect(dataset).toEqual(expected(saved));
  });

  it.each(SAVED_VALUES)("agrees on a device that prefers light, for saved value %s", (saved) => {
    const dataset = runBootScript((key) => (key === SETTINGS_STORAGE_KEY ? saved : null), true);
    expect(dataset).toEqual(expected(saved, true));
  });

  it("treats the system theme as dark in a browser without matchMedia", () => {
    const saved = JSON.stringify({ appTheme: "system", sidebarCollapsed: true });
    expect(runBootScript(() => saved, undefined)).toEqual({ sidebar: "collapsed" });
  });

  it("does nothing, without throwing, when storage is blocked", () => {
    expect(
      runBootScript(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      }),
    ).toEqual({});
  });
});
