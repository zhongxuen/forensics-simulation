import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { findStorageAccess } from "./helpers/find-storage-access";

/**
 * No mission data in browser storage (md-files/03-app-state-and-privacy.md, rule 1). The only
 * code allowed to touch localStorage, sessionStorage, indexedDB or cookies is the settings module
 * in src/lib/settings/, which holds display settings and nothing else.
 */

const ROOT = join(import.meta.dirname, "../..");
const ALLOWED_DIR = "src/lib/settings/";
const FIXTURES = join(import.meta.dirname, "fixtures/storage-guard");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [path] : [];
  });
}

function scan(path: string) {
  return findStorageAccess(readFileSync(path, "utf8"), path);
}

describe("findStorageAccess", () => {
  it("flags a file that uses localStorage", () => {
    expect(scan(join(FIXTURES, "uses-local-storage.ts"))).toEqual([
      { line: 4, name: "localStorage" },
    ]);
  });

  it("flags storage reached through window, globalThis, self, brackets and destructuring", () => {
    const names = scan(join(FIXTURES, "sneaky-access.tsx")).map((access) => access.name);
    expect(new Set(names)).toEqual(
      new Set(["sessionStorage", "localStorage", "indexedDB", "document.cookie"]),
    );
    expect(names.filter((name) => name === "document.cookie")).toHaveLength(2);
  });

  it("flags the Cache API, navigator.storage, service workers and WebSQL too", () => {
    expect(new Set(scan(join(FIXTURES, "other-storage.ts")).map((access) => access.name))).toEqual(
      new Set(["caches", "navigator.storage", "navigator.serviceWorker", "openDatabase"]),
    );
  });

  it("ignores comments and strings that only mention storage", () => {
    expect(scan(join(FIXTURES, "mentions-only.ts"))).toEqual([]);
  });
});

describe("storage guard", () => {
  it("finds no browser storage access in src/ outside src/lib/settings/", () => {
    const offenders = sourceFiles(join(ROOT, "src"))
      .map((path) => relative(ROOT, path).replaceAll("\\", "/"))
      .filter((path) => !path.startsWith(ALLOWED_DIR))
      .flatMap((path) =>
        scan(join(ROOT, path)).map((access) => `${path}:${access.line} uses ${access.name}`),
      );

    expect(
      offenders,
      "Only src/lib/settings/ may touch browser storage, and only for settings. Use getSettings/updateSettings from @/lib/settings; mission runs live in memory.",
    ).toEqual([]);
  });

  it("still sees the settings module's own storage access", () => {
    // Proves the scan reaches src/lib/settings/, so the exemption above is doing the work.
    const settingsAccess = sourceFiles(join(ROOT, ALLOWED_DIR)).flatMap(scan);
    expect(settingsAccess.map((access) => access.name)).toContain("localStorage");
  });
});
