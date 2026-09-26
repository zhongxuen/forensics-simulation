import { describe, expect, it } from "vitest";
import {
  CASES_STORAGE_KEY,
  createCaseStorage,
  EMPTY_CASE_STORE,
  migrate,
  type CaseRunSave,
} from "@/lib/case-storage";

/**
 * Saved case runs (docs/plan/05-workspace-ui.md §Saving case runs): what's kept, how a bad or old
 * value is read, and what happens when the browser won't let us save. Storage is a stand-in here,
 * so every way real storage misbehaves can be made to happen on purpose.
 */

/** A working Storage, backed by a Map. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const items = new Map(Object.entries(initial));
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

/** The same storage every time it's asked for, as the browser's is. */
const storageOf = (storage: Storage) => () => storage;

/** Storage that refuses everything, like a browser with site data blocked. */
function blockedStorage(): Storage {
  const refuse = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  return {
    length: 0,
    clear: refuse,
    getItem: refuse,
    key: refuse,
    removeItem: refuse,
    setItem: refuse,
  };
}

/** Storage that reads fine but is full. */
function fullStorage(): Storage {
  return {
    ...memoryStorage(),
    setItem: () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    },
  };
}

const RUN: CaseRunSave = {
  phase: "workspace",
  log: [{ line: "cat cases/practice/letter.txt" }, { reset: true }, { line: "ls -a" }],
  pins: ["disk:qf-lt-03:mft/64", "log:security/2"],
  notes: "Seal QF-0412 matches the form.",
  reportDraft: { summary: "Nothing was opened on the way." },
  completed: ["read-letter"],
  hintsShown: { "find-seal": 2 },
  beatsPlayed: [0, 1],
  citations: {},
  pinNotes: {},
  marks: [],
  savedAt: 1_770_000_000_000,
};

describe("case storage", () => {
  it("saves a run under incident-room:cases:v1 and loads it back", () => {
    const storage = memoryStorage();
    const cases = createCaseStorage({ storage: () => storage });
    expect(cases.save("practice", RUN)).toBe(true);
    expect(cases.saveStatus()).toBe("saved");
    expect(JSON.parse(storage.getItem(CASES_STORAGE_KEY) ?? "")).toEqual({
      v: 1,
      runs: { practice: RUN },
    });
    expect(cases.load("practice")).toEqual(RUN);
    expect(cases.load("case-01")).toBeUndefined();
  });

  it("keeps other cases' runs when one is saved or removed", () => {
    const storage = memoryStorage();
    const cases = createCaseStorage({ storage: () => storage });
    cases.save("practice", RUN);
    cases.save("case-01", { ...RUN, notes: "" });
    expect(cases.remove("practice")).toBe(true);
    expect(Object.keys(cases.read().runs)).toEqual(["case-01"]);
  });

  it("reads a corrupted value as nothing saved, and a new save replaces it", () => {
    const storage = memoryStorage({ [CASES_STORAGE_KEY]: "{not json" });
    const cases = createCaseStorage({ storage: () => storage });
    expect(cases.read()).toEqual(EMPTY_CASE_STORE);
    expect(cases.load("practice")).toBeUndefined();
    expect(cases.save("practice", RUN)).toBe(true);
    expect(cases.load("practice")).toEqual(RUN);
  });

  it("leaves out a run that doesn't validate, and keeps the others", () => {
    const storage = memoryStorage({
      [CASES_STORAGE_KEY]: JSON.stringify({
        v: 1,
        runs: {
          practice: RUN,
          "case-01": { ...RUN, phase: "somewhere" },
          "case-02": { ...RUN, pins: ["not a ref"] },
          "case-03": { ...RUN, log: [{ line: 42 }] },
          "Bad Id": RUN,
        },
      }),
    });
    const cases = createCaseStorage({ storage: () => storage });
    expect(Object.keys(cases.read().runs)).toEqual(["practice"]);
  });

  it("migrates a v0 value: typed lines become the command log, ticks carry over", () => {
    const v0 = {
      v: 0,
      runs: {
        practice: {
          commands: ["cat cases/practice/letter.txt", "grep Sealed cases/practice/handover.txt"],
          pins: ["log:security/2"],
          notes: "From before.",
          ticked: ["read-letter", "find-seal"],
        },
        "case-01": { commands: "not a list" },
      },
    };
    expect(migrate(v0)).toEqual({
      v: 1,
      runs: {
        practice: {
          phase: "workspace",
          log: [
            { line: "cat cases/practice/letter.txt" },
            { line: "grep Sealed cases/practice/handover.txt" },
          ],
          pins: ["log:security/2"],
          notes: "From before.",
          reportDraft: {},
          completed: ["read-letter", "find-seal"],
          hintsShown: {},
          beatsPlayed: [],
          citations: {},
          pinNotes: {},
          marks: [],
          savedAt: 0,
        },
      },
    });

    // An unversioned value is v0 too, and loading from storage goes through the same path.
    const storage = memoryStorage({
      [CASES_STORAGE_KEY]: JSON.stringify({ runs: { practice: { commands: ["ls"] } } }),
    });
    const cases = createCaseStorage({ storage: () => storage });
    expect(cases.load("practice")?.log).toEqual([{ line: "ls" }]);
  });

  it("reads a v1 save from before citations, pin notes and custody marks, with them empty", () => {
    const older: Record<string, unknown> = { ...RUN };
    for (const key of ["citations", "pinNotes", "marks"]) delete older[key];
    const store = migrate({ v: 1, runs: { practice: older } });
    expect(store.runs.practice).toEqual({ ...RUN, citations: {}, pinNotes: {}, marks: [] });
  });

  it("keeps citations, pin notes and custody marks, and refuses marks that aren't marks", () => {
    const withBoard: CaseRunSave = {
      ...RUN,
      citations: { "note-created": ["disk:qf-lt-03:mft/64"] },
      pinNotes: { "disk:qf-lt-03:mft/64": "the note nobody wrote" },
      marks: [
        { after: 3, kind: "pinned", ref: "log:security/2" },
        { after: 5, kind: "submitted", supported: 2, total: 3 },
      ],
    };
    expect(migrate({ v: 1, runs: { practice: withBoard } }).runs.practice).toEqual(withBoard);
    const odd = { ...withBoard, marks: [{ after: -1, kind: "pinned", ref: "x" }] };
    expect(migrate({ v: 1, runs: { practice: odd } }).runs).toEqual({});
  });

  it("reads anything else as an empty store, without throwing", () => {
    for (const raw of [null, 42, "text", [], { v: 1 }, { v: 1, runs: [] }, { v: 99, runs: {} }]) {
      expect(migrate(raw)).toEqual(EMPTY_CASE_STORE);
    }
  });

  it("says when storage is blocked, and never throws", () => {
    const cases = createCaseStorage({ storage: blockedStorage });
    expect(cases.load("practice")).toBeUndefined();
    expect(cases.save("practice", RUN)).toBe(false);
    expect(cases.saveStatus()).toBe("blocked");
    expect(cases.remove("practice")).toBe(false);
    expect(cases.clear()).toBe(false);
    expect(cases.importText(JSON.stringify({ v: 1, runs: { practice: RUN } }))).toMatchObject({
      ok: false,
    });
  });

  it("says when storage is missing altogether, or throws on the way in", () => {
    const missing = createCaseStorage({ storage: () => undefined });
    expect(missing.save("practice", RUN)).toBe(false);
    const throwing = createCaseStorage({
      storage: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });
    expect(throwing.save("practice", RUN)).toBe(false);
    expect(throwing.saveStatus()).toBe("blocked");
  });

  it("says when storage is full", () => {
    const cases = createCaseStorage({ storage: fullStorage });
    expect(cases.save("practice", RUN)).toBe(false);
    expect(cases.saveStatus()).toBe("blocked");
  });

  it("tells listeners when saving stops or starts working", () => {
    let works = false;
    const storage = memoryStorage();
    const cases = createCaseStorage({ storage: () => (works ? storage : blockedStorage()) });
    const seen: string[] = [];
    const stop = cases.subscribe(() => seen.push(cases.saveStatus()));
    cases.save("practice", RUN);
    cases.save("practice", RUN);
    works = true;
    cases.save("practice", RUN);
    stop();
    expect(seen).toEqual(["blocked", "saved"]);
  });

  it("clears every saved run", () => {
    const storage = memoryStorage();
    const cases = createCaseStorage({ storage: () => storage });
    cases.save("practice", RUN);
    expect(cases.clear()).toBe(true);
    expect(storage.getItem(CASES_STORAGE_KEY)).toBeNull();
  });
});

describe("export and import", () => {
  it("exports every run as JSON that imports back into another browser", () => {
    const from = createCaseStorage({ storage: storageOf(memoryStorage()) });
    from.save("practice", RUN);
    const file = from.exportText();

    const to = createCaseStorage({ storage: storageOf(memoryStorage()) });
    to.save("case-01", RUN);
    expect(to.importText(file)).toEqual({ ok: true, imported: 1 });
    expect(Object.keys(to.read().runs).sort()).toEqual(["case-01", "practice"]);
    expect(to.load("practice")).toEqual(RUN);
  });

  it("refuses a file that isn't JSON, has no cases, or has a run that doesn't validate, and keeps what was saved", () => {
    const storage = memoryStorage();
    const cases = createCaseStorage({ storage: () => storage });
    cases.save("practice", RUN);
    const before = storage.getItem(CASES_STORAGE_KEY);

    for (const text of [
      "not json",
      JSON.stringify({ v: 1, runs: {} }),
      JSON.stringify({ hello: "world" }),
      JSON.stringify({ v: 1, runs: { practice: RUN, "case-01": { ...RUN, phase: "hacked" } } }),
      JSON.stringify({ v: 1, runs: { practice: { ...RUN, log: [{ run: "rm -rf /" }] } } }),
    ]) {
      const result = cases.importText(text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).not.toMatch(/invalid|illegal|wrong|failed/i);
    }
    expect(storage.getItem(CASES_STORAGE_KEY)).toBe(before);
  });

  it("imports a v0 export through migrate", () => {
    const cases = createCaseStorage({ storage: storageOf(memoryStorage()) });
    const result = cases.importText(
      JSON.stringify({ v: 0, runs: { practice: { commands: ["ls"] } } }),
    );
    expect(result).toEqual({ ok: true, imported: 1 });
    expect(cases.load("practice")?.log).toEqual([{ line: "ls" }]);
  });
});
