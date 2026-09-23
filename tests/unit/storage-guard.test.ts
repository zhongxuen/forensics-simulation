import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { findStorageAccess } from "./helpers/find-storage-access";

/**
 * Browser storage has two doors and no others. The settings module in src/lib/settings/ holds
 * display settings, and src/lib/case-storage/ holds saved case runs (docs/plan/05-workspace-ui.md,
 * a deliberate divergence from Hacker Simulation, 00 §4 row 9). Nothing else may touch
 * localStorage, sessionStorage, indexedDB or cookies.
 */

const ROOT = join(import.meta.dirname, "../..");
const ALLOWED_DIRS = ["src/lib/settings/", "src/lib/case-storage/"];
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
  it("finds no browser storage access in src/ outside the two storage modules", () => {
    const offenders = sourceFiles(join(ROOT, "src"))
      .map((path) => relative(ROOT, path).replaceAll("\\", "/"))
      .filter((path) => !ALLOWED_DIRS.some((dir) => path.startsWith(dir)))
      .flatMap((path) =>
        scan(join(ROOT, path)).map((access) => `${path}:${access.line} uses ${access.name}`),
      );

    expect(
      offenders,
      "Only src/lib/settings/ and src/lib/case-storage/ may touch browser storage. Use @/lib/settings for settings and @/lib/case-storage for saved case runs.",
    ).toEqual([]);
  });

  it.each(ALLOWED_DIRS)("still sees %s's own storage access", (dir) => {
    // Proves the scan reaches each allowed folder, so the exemption above is doing the work.
    const access = sourceFiles(join(ROOT, dir)).flatMap(scan);
    expect(access.map((found) => found.name)).toContain("localStorage");
  });
});
