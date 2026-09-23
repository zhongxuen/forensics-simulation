import {
  CASE_STORE_VERSION,
  CaseRunSaveSchema,
  EMPTY_CASE_STORE,
  MAX_RUNS,
  migrate,
  migrateWithReport,
  type CaseRunSave,
  type CaseStore,
} from "./schema";

/** The one localStorage key for saved case runs. Its value is a CaseStore as JSON. */
export const CASES_STORAGE_KEY = "incident-room:cases:v1";

export interface CaseStorageOptions {
  /** Where runs are saved. May return undefined, or throw, when storage is blocked. */
  storage: () => Storage | undefined;
}

/** What came of an import: how many runs it brought in, or why it brought in none. */
export type ImportResult =
  | { readonly ok: true; readonly imported: number }
  | { readonly ok: false; readonly reason: string };

/**
 * Whether the latest save worked: `unknown` before the first attempt, `blocked` when storage
 * refused it (blocked site data, a private window, a full quota).
 */
export type SaveStatus = "unknown" | "saved" | "blocked";

export interface CaseStorage {
  /** Every saved run, migrated to the current shape. Empty when storage is blocked. */
  read(): CaseStore;
  /** The saved run for one case, or undefined. */
  load(caseId: string): CaseRunSave | undefined;
  /** Saves one case's run. Returns false when storage is blocked or full: the game plays on. */
  save(caseId: string, run: CaseRunSave): boolean;
  /** Forgets one case's run. Returns false when storage is blocked. */
  remove(caseId: string): boolean;
  /** Forgets every saved run. Returns false when storage is blocked. */
  clear(): boolean;
  /** Every saved run as a JSON file's text, for "Export my cases". */
  exportText(): string;
  /**
   * Reads an exported file back in. It's validated with the same schema as storage, and refused
   * whole if any run in it doesn't pass. Imported runs replace saved runs for the same case; runs
   * for other cases stay. Nothing in it is run: a case replays its log only when it's opened.
   */
  importText(text: string): ImportResult;
  /** How the latest `save` went, for the "isn't letting us save" banner. */
  saveStatus(): SaveStatus;
  /** Runs `listener` whenever `saveStatus` changes. */
  subscribe(listener: () => void): () => void;
}

/**
 * Saved case runs over `storage`. Storage can be missing or throw on any call (private windows,
 * blocked site data, a full quota), and saved JSON can be anything, so every access is guarded.
 */
export function createCaseStorage({ storage }: CaseStorageOptions): CaseStorage {
  let status: SaveStatus = "unknown";
  const listeners = new Set<() => void>();

  function setStatus(next: SaveStatus) {
    if (next === status) return;
    status = next;
    for (const listener of listeners) listener();
  }

  function read(): CaseStore {
    try {
      const raw = storage()?.getItem(CASES_STORAGE_KEY);
      return raw == null ? EMPTY_CASE_STORE : migrate(JSON.parse(raw));
    } catch {
      // Blocked storage, or JSON that doesn't parse.
      return EMPTY_CASE_STORE;
    }
  }

  function write(store: CaseStore): boolean {
    try {
      const target = storage();
      if (!target) return false;
      target.setItem(CASES_STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch {
      // Blocked, or over the quota.
      return false;
    }
  }

  function reachable(): boolean {
    try {
      const target = storage();
      target?.getItem(CASES_STORAGE_KEY);
      return target !== undefined;
    } catch {
      return false;
    }
  }

  function withRuns(runs: Record<string, CaseRunSave>): CaseStore {
    return { v: CASE_STORE_VERSION, runs };
  }

  return {
    read,

    load(caseId) {
      const { runs } = read();
      return Object.hasOwn(runs, caseId) ? runs[caseId] : undefined;
    },

    save(caseId, run) {
      const parsed = CaseRunSaveSchema.safeParse(run);
      if (!parsed.success) return false;
      const saved = write(withRuns({ ...read().runs, [caseId]: parsed.data }));
      setStatus(saved ? "saved" : "blocked");
      return saved;
    },

    remove(caseId) {
      const runs: Record<string, CaseRunSave> = { ...read().runs };
      // Nothing to forget, but say whether storage could have been reached at all.
      if (!Object.hasOwn(runs, caseId)) return reachable();
      delete runs[caseId];
      return write(withRuns(runs));
    },

    clear() {
      try {
        const target = storage();
        if (!target) return false;
        target.removeItem(CASES_STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },

    exportText() {
      return `${JSON.stringify(read(), null, 2)}\n`;
    },

    importText(text) {
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return {
          ok: false,
          reason:
            "That file isn't one we can read. It isn't in the JSON format an export makes. Pick the file that Export my cases saved.",
        };
      }
      const { store, rejected } = migrateWithReport(raw);
      if (rejected.length > 0) {
        return {
          ok: false,
          reason: `Nothing was imported. The saved run for ${rejected.join(", ")} doesn't match what this version expects. Try exporting it again, or pick another file.`,
        };
      }
      const imported = Object.keys(store.runs).length;
      if (imported === 0) {
        return {
          ok: false,
          reason:
            "That file has no saved cases in it. It may be from somewhere else. Pick the file that Export my cases saved.",
        };
      }
      const runs = { ...read().runs, ...store.runs };
      if (Object.keys(runs).length > MAX_RUNS) {
        return {
          ok: false,
          reason: `Nothing was imported. That would keep more than ${MAX_RUNS} cases. Clear some first, then try again.`,
        };
      }
      if (!write(withRuns(runs))) {
        return {
          ok: false,
          reason:
            "Nothing was imported. This browser isn't letting us save right now. Check that site data is allowed for this page, then try again.",
        };
      }
      return { ok: true, imported };
    },

    saveStatus: () => status,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const browser = typeof window === "undefined" ? undefined : window;

/** The app's saved case runs, in this browser. */
export const caseStorage: CaseStorage = createCaseStorage({
  storage: () => browser?.localStorage,
});
