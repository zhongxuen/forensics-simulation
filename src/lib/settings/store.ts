import { applySettingsToElement, PREFERS_LIGHT_QUERY } from "./document";
import { DEFAULT_SETTINGS, parseSettings, sameSettings, type Settings } from "./schema";

/** The one localStorage key the app uses. Its value is the settings object as JSON. */
export const SETTINGS_STORAGE_KEY = "incident-room:settings";

export interface SettingsStoreOptions {
  /** Where settings are saved. May return undefined, or throw, when storage is blocked. */
  storage: () => Storage | undefined;
  /** Where `storage` events from other tabs arrive: the window. */
  events?: () => EventTarget | undefined;
  /** Called with every new value, after it's in place and before listeners run. */
  onChange?: (settings: Readonly<Settings>) => void;
}

export interface SettingsStore {
  /** The current settings. The same object until something changes, so React can compare it. */
  get(): Readonly<Settings>;
  /**
   * Changes some settings. The change always applies for this visit; the return value says
   * whether it was also saved for the next one (false when storage is blocked).
   */
  update(changes: Partial<Settings>): boolean;
  /** Puts every setting back to its default. Returns whether storage was cleared too. */
  reset(): boolean;
  /** Runs `listener` after every change, including changes made in another tab. */
  subscribe(listener: () => void): () => void;
}

/**
 * A settings store over `storage`. Storage can be missing or throw on any call (private windows,
 * blocked site data), and saved JSON can be anything, so every access is guarded: the app then
 * runs on defaults, and changes last until the page is reloaded.
 */
export function createSettingsStore({
  storage,
  events,
  onChange,
}: SettingsStoreOptions): SettingsStore {
  let current: Readonly<Settings> | undefined;
  const listeners = new Set<() => void>();

  function readSaved(): Readonly<Settings> {
    try {
      const raw = storage()?.getItem(SETTINGS_STORAGE_KEY);
      return raw == null ? DEFAULT_SETTINGS : parseSettings(JSON.parse(raw));
    } catch {
      // Blocked storage, or JSON that doesn't parse.
      return DEFAULT_SETTINGS;
    }
  }

  function replace(next: Readonly<Settings>) {
    if (current !== undefined && sameSettings(current, next)) return;
    current = next;
    onChange?.(next);
    for (const listener of listeners) listener();
  }

  function get(): Readonly<Settings> {
    current ??= readSaved();
    return current;
  }

  function onStorage(event: Event) {
    // A null key means another tab cleared all of this site's storage.
    const { key } = event as StorageEvent;
    if (key === SETTINGS_STORAGE_KEY || key === null) replace(readSaved());
  }

  return {
    get,

    update(changes) {
      const next = parseSettings({ ...get(), ...changes });
      let saved = false;
      try {
        const target = storage();
        if (target) {
          target.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
          saved = true;
        }
      } catch {
        // Blocked or full: the change still applies until the page is reloaded.
      }
      replace(next);
      return saved;
    },

    reset() {
      let saved = false;
      try {
        const target = storage();
        if (target) {
          target.removeItem(SETTINGS_STORAGE_KEY);
          saved = true;
        }
      } catch {
        // Blocked: defaults apply until the page is reloaded.
      }
      replace(DEFAULT_SETTINGS);
      return saved;
    },

    subscribe(listener) {
      if (listeners.size === 0) {
        events?.()?.addEventListener("storage", onStorage);
        // Nothing was listening for other tabs until now, so catch up with what they saved.
        replace(readSaved());
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) events?.()?.removeEventListener("storage", onStorage);
      };
    },
  };
}

const browser = typeof window === "undefined" ? undefined : window;

// Absent in some test environments and very old browsers: then "system" means dark.
const colourScheme = browser?.matchMedia?.(PREFERS_LIGHT_QUERY);

function applyToPage(settings: Readonly<Settings>) {
  if (browser) {
    applySettingsToElement(browser.document.documentElement, settings, colourScheme?.matches);
  }
}

/** The app's settings, saved in this browser and mirrored onto <html>. */
export const settingsStore: SettingsStore = createSettingsStore({
  storage: () => browser?.localStorage,
  events: () => browser,
  onChange: applyToPage,
});

// With the "system" theme, follow the device when it switches between light and dark.
colourScheme?.addEventListener?.("change", () => {
  if (settingsStore.get().appTheme === "system") applyToPage(settingsStore.get());
});

export const getSettings = (): Readonly<Settings> => settingsStore.get();

export const updateSettings = (changes: Partial<Settings>): boolean =>
  settingsStore.update(changes);

export const resetSettings = (): boolean => settingsStore.reset();

export const subscribeSettings = (listener: () => void): (() => void) =>
  settingsStore.subscribe(listener);
