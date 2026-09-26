import { describe, expect, it, vi } from "vitest";
import { applySettingsToElement } from "@/lib/settings/document";
import {
  DEFAULT_SETTINGS,
  parseSettings,
  REDUCED_MOTION_OVERRIDES,
  type Settings,
} from "@/lib/settings/schema";
import { createSettingsStore, SETTINGS_STORAGE_KEY } from "@/lib/settings/store";

/** An in-memory Storage, like localStorage in a normal browser tab. */
class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

/** A Storage that throws on every call, like a private window or blocked site data. */
class BlockedStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new DOMException("The operation is insecure.", "SecurityError");
  }
  override setItem(): void {
    throw new DOMException("The operation is insecure.", "SecurityError");
  }
  override removeItem(): void {
    throw new DOMException("The operation is insecure.", "SecurityError");
  }
}

function storeOver(storage: Storage, events?: EventTarget) {
  return createSettingsStore({ storage: () => storage, events: () => events });
}

function withSaved(value: string) {
  const storage = new MemoryStorage();
  storage.setItem(SETTINGS_STORAGE_KEY, value);
  return storage;
}

/** What a `storage` event from another tab carries. Node has Event, but not StorageEvent. */
function storageEvent(key: string | null) {
  return Object.assign(new Event("storage"), { key });
}

describe("parseSettings", () => {
  it("fills in defaults on first run", () => {
    expect(parseSettings(undefined)).toEqual({
      appTheme: "dark",
      sidebarCollapsed: false,
      reducedMotionOverride: "system",
      beginnerMode: true,
      networkView: "graph",
      terminalTheme: "candlewright",
      promptStyle: "classic",
      cursorStyle: "block",
      nudgeChip: true,
      usageCounts: true,
    });
    expect(DEFAULT_SETTINGS).toEqual(parseSettings({}));
  });

  it("falls back per field, so one bad value doesn't wipe the others", () => {
    expect(parseSettings({ sidebarCollapsed: "yes", reducedMotionOverride: "reduce" })).toEqual({
      ...DEFAULT_SETTINGS,
      reducedMotionOverride: "reduce",
    });
    expect(parseSettings({ sidebarCollapsed: true, reducedMotionOverride: "sometimes" })).toEqual({
      ...DEFAULT_SETTINGS,
      sidebarCollapsed: true,
    });
    expect(parseSettings({ terminalTheme: "amber", cursorStyle: "sparkly" })).toEqual({
      ...DEFAULT_SETTINGS,
      terminalTheme: "amber",
    });
    expect(parseSettings({ networkView: "table", promptStyle: "huge" })).toEqual({
      ...DEFAULT_SETTINGS,
      networkView: "table",
    });
    expect(parseSettings({ beginnerMode: false }).beginnerMode).toBe(false);
    expect(parseSettings({ beginnerMode: "off" }).beginnerMode).toBe(true);
    expect(parseSettings({ nudgeChip: false }).nudgeChip).toBe(false);
    expect(parseSettings({ nudgeChip: "no" }).nudgeChip).toBe(true);
    expect(parseSettings({ appTheme: "light" }).appTheme).toBe("light");
    expect(parseSettings({ appTheme: "sepia" }).appTheme).toBe("dark");
  });

  it("drops unknown keys", () => {
    expect(
      parseSettings({ sidebarCollapsed: true, completedMissions: ["intro-01"], xp: 900 }),
    ).toEqual({ ...DEFAULT_SETTINGS, sidebarCollapsed: true });
  });

  it("treats anything that isn't an object as nothing saved", () => {
    for (const raw of [null, 42, "collapsed", true, ["sidebarCollapsed"]]) {
      expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it("lists every motion choice", () => {
    expect(REDUCED_MOTION_OVERRIDES).toEqual(["system", "reduce", "full"]);
  });
});

describe("settings store", () => {
  it("starts on defaults when nothing is saved", () => {
    expect(storeOver(new MemoryStorage()).get()).toEqual(DEFAULT_SETTINGS);
  });

  it("reads what was saved", () => {
    const store = storeOver(
      withSaved(JSON.stringify({ sidebarCollapsed: true, reducedMotionOverride: "full" })),
    );
    expect(store.get()).toEqual({
      ...DEFAULT_SETTINGS,
      sidebarCollapsed: true,
      reducedMotionOverride: "full",
    });
  });

  it("falls back to defaults on corrupt JSON, without throwing", () => {
    for (const saved of ["{not json", "", "undefined", "null", "[]", '"collapsed"']) {
      expect(storeOver(withSaved(saved)).get()).toEqual(DEFAULT_SETTINGS);
    }
  });

  it("drops unknown keys and saves only known settings", () => {
    const storage = withSaved(JSON.stringify({ sidebarCollapsed: true, streak: 12 }));
    const store = storeOver(storage);
    expect(store.get()).toEqual({ ...DEFAULT_SETTINGS, sidebarCollapsed: true });

    store.update({ reducedMotionOverride: "reduce" });
    expect(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? "")).toEqual({
      ...DEFAULT_SETTINGS,
      sidebarCollapsed: true,
      reducedMotionOverride: "reduce",
    });
  });

  it("saves changes so the next visit sees them", () => {
    const storage = new MemoryStorage();
    expect(storeOver(storage).update({ sidebarCollapsed: true })).toBe(true);
    expect(storeOver(storage).get().sidebarCollapsed).toBe(true);
  });

  it("returns the same object until something changes", () => {
    const store = storeOver(new MemoryStorage());
    const first = store.get();
    expect(store.get()).toBe(first);
    store.update({ sidebarCollapsed: false });
    expect(store.get()).toBe(first);
    store.update({ sidebarCollapsed: true });
    expect(store.get()).not.toBe(first);
    expect(Object.isFrozen(store.get())).toBe(true);
  });

  it("resets to defaults and clears what was saved", () => {
    const storage = withSaved(JSON.stringify({ sidebarCollapsed: true }));
    const store = storeOver(storage);
    expect(store.reset()).toBe(true);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it("notifies listeners and onChange on every change", () => {
    const onChange = vi.fn();
    const store = createSettingsStore({ storage: () => new MemoryStorage(), onChange });
    const listener = vi.fn();
    store.subscribe(listener);
    onChange.mockClear();

    store.update({ reducedMotionOverride: "reduce" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SETTINGS,
      reducedMotionOverride: "reduce",
    });

    store.update({ reducedMotionOverride: "reduce" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe("with storage blocked", () => {
    it("works on defaults when every storage call throws", () => {
      const store = storeOver(new BlockedStorage());
      expect(store.get()).toEqual(DEFAULT_SETTINGS);
      expect(store.update({ sidebarCollapsed: true })).toBe(false);
      // The change still applies for this visit.
      expect(store.get().sidebarCollapsed).toBe(true);
      expect(store.reset()).toBe(false);
      expect(store.get()).toEqual(DEFAULT_SETTINGS);
    });

    it("works when even reaching storage throws", () => {
      const store = createSettingsStore({
        storage: () => {
          throw new DOMException("Access is denied for this document.", "SecurityError");
        },
      });
      expect(store.get()).toEqual(DEFAULT_SETTINGS);
      expect(store.update({ reducedMotionOverride: "full" })).toBe(false);
      expect(store.get().reducedMotionOverride).toBe("full");
      expect(store.reset()).toBe(false);
    });

    it("works with no storage at all", () => {
      const store = createSettingsStore({ storage: () => undefined });
      expect(store.get()).toEqual(DEFAULT_SETTINGS);
      expect(store.update({ sidebarCollapsed: true })).toBe(false);
      expect(store.get().sidebarCollapsed).toBe(true);
    });
  });

  describe("changes from other tabs", () => {
    it("picks up a change saved in another tab", () => {
      const storage = new MemoryStorage();
      const window = new EventTarget();
      const store = storeOver(storage, window);
      const listener = vi.fn();
      store.subscribe(listener);

      // Another tab saves, then the browser tells this one.
      storeOver(storage).update({ sidebarCollapsed: true });
      window.dispatchEvent(storageEvent(SETTINGS_STORAGE_KEY));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.get().sidebarCollapsed).toBe(true);
    });

    it("goes back to defaults when another tab clears site data", () => {
      const storage = withSaved(JSON.stringify({ reducedMotionOverride: "reduce" }));
      const window = new EventTarget();
      const store = storeOver(storage, window);
      store.subscribe(() => {});
      expect(store.get().reducedMotionOverride).toBe("reduce");

      storage.clear();
      window.dispatchEvent(storageEvent(null));
      expect(store.get()).toEqual(DEFAULT_SETTINGS);
    });

    it("ignores other keys, and stops listening once nothing is subscribed", () => {
      const storage = new MemoryStorage();
      const window = new EventTarget();
      const store = storeOver(storage, window);
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      window.dispatchEvent(storageEvent("some-other-key"));
      expect(listener).not.toHaveBeenCalled();

      unsubscribe();
      storeOver(storage).update({ sidebarCollapsed: true });
      window.dispatchEvent(storageEvent(SETTINGS_STORAGE_KEY));
      expect(listener).not.toHaveBeenCalled();
    });

    it("catches up with other tabs when something subscribes", () => {
      const storage = new MemoryStorage();
      const store = storeOver(storage, new EventTarget());
      expect(store.get().sidebarCollapsed).toBe(false);

      // Saved elsewhere while nothing here was listening.
      storeOver(storage).update({ sidebarCollapsed: true });
      store.subscribe(() => {});
      expect(store.get().sidebarCollapsed).toBe(true);
    });
  });
});

describe("applySettingsToElement", () => {
  function apply(
    settings: Partial<Settings>,
    dataset: Record<string, string> = {},
    prefersLight = false,
  ) {
    const root = { dataset: dataset as DOMStringMap };
    applySettingsToElement(root, parseSettings(settings), prefersLight);
    return { ...root.dataset };
  }

  it("marks a collapsed sidebar and a motion override on <html>", () => {
    expect(apply({ sidebarCollapsed: true, reducedMotionOverride: "reduce" })).toEqual({
      sidebar: "collapsed",
      motion: "reduce",
    });
    expect(apply({ reducedMotionOverride: "full" })).toEqual({ motion: "full" });
  });

  it("marks a terminal theme other than the default", () => {
    expect(apply({ terminalTheme: "phosphor" })).toEqual({ terminalTheme: "phosphor" });
  });

  it("marks Daylight, and follows the device for the system theme", () => {
    expect(apply({ appTheme: "light" })).toEqual({ theme: "light" });
    expect(apply({ appTheme: "dark" }, {}, true)).toEqual({});
    expect(apply({ appTheme: "system" }, {}, true)).toEqual({ theme: "light" });
    expect(apply({ appTheme: "system" }, { theme: "light" }, false)).toEqual({});
  });

  it("removes every attribute for the defaults, leaving others alone", () => {
    expect(
      apply(
        {},
        {
          sidebar: "collapsed",
          motion: "reduce",
          terminalTheme: "amber",
          theme: "light",
          other: "kept",
        },
      ),
    ).toEqual({ other: "kept" });
  });
});
