import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, type Settings } from "./schema";
import { getSettings, subscribeSettings } from "./store";

const getServerSettings = (): Readonly<Settings> => DEFAULT_SETTINGS;

/**
 * The learner's settings, re-rendering whenever they change: here, from another component, or in
 * another tab. The server (and the first render in the browser) sees the defaults; right after
 * hydration React re-renders with the saved values. Change them with updateSettings.
 */
export function useSettings(): Readonly<Settings> {
  return useSyncExternalStore(subscribeSettings, getSettings, getServerSettings);
}
