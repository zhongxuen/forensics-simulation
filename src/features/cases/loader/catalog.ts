import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SANDBOX_FILE, type Case } from "@/content/cases/schema";
import {
  CASE_FILE_EXTENSION,
  CaseSourceError,
  FIXTURE_PREFIX,
  parseCaseSource,
  type CaseFile,
} from "./source";

/**
 * The case catalog: every case file in `src/content/cases`. There is no database — the content
 * files are the whole catalog — so a case that doesn't validate fails `next build` and `pnpm test`
 * with a message that names the file and everything wrong in it.
 *
 * Server only: it reads files with Node's fs. Case pages are built at build time.
 */

/** Where case files live, relative to the project root. */
export const CASES_DIR = join(process.cwd(), "src", "content", "cases");

export interface CaseCatalog {
  /** Every playable case, in id order. Fixtures are left out. */
  readonly cases: readonly Case[];
  /** Every case, fixtures included, in id order. */
  readonly all: readonly Case[];
  getCase(id: string): Case | undefined;
}

/** True for a case that exists to exercise the pipeline and is never offered to a player. */
export function isFixtureCase(id: string): boolean {
  return id.startsWith(FIXTURE_PREFIX);
}

/** Checks what no single file can: that ids are unique. */
export function buildCaseCatalog(files: readonly CaseFile[]): CaseCatalog {
  const byId = new Map<string, CaseFile>();
  for (const file of files) {
    const same = byId.get(file.case.id);
    if (same) {
      throw new CaseSourceError(file.fileName, [
        `id "${file.case.id}" is also used by ${same.fileName}. Case ids are unique and never reused.`,
      ]);
    }
    byId.set(file.case.id, file);
  }

  const all = [...byId.values()]
    .map((file) => file.case)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    all,
    cases: all.filter((entry) => !isFixtureCase(entry.id)),
    getCase: (id) => byId.get(id)?.case,
  };
}

/** Reads and checks every case file in `dir`. */
export function loadCaseCatalog(dir: string = CASES_DIR): CaseCatalog {
  const names = readdirSync(dir).sort();
  // A case saved as .yml would be quietly skipped, so say so instead.
  const misnamed = names.find((name) => name.endsWith(".yml"));
  if (misnamed) {
    throw new CaseSourceError(misnamed, [
      `Case files end in ${CASE_FILE_EXTENSION}. Rename it to ${misnamed.replace(/\.yml$/, CASE_FILE_EXTENSION)}.`,
    ]);
  }
  return buildCaseCatalog(
    names
      // The sandbox is written like a case but isn't one (loader/sandbox.ts).
      .filter((name) => name.endsWith(CASE_FILE_EXTENSION) && name !== SANDBOX_FILE)
      .map((fileName) => ({
        fileName,
        case: parseCaseSource(readFileSync(join(dir, fileName), "utf8"), fileName),
      })),
  );
}

let cached: CaseCatalog | undefined;

/**
 * The catalog for `src/content/cases`. Cached in production; in development it is read again on
 * every call, so an edited case shows up on reload.
 */
export function getCaseCatalog(): CaseCatalog {
  if (process.env.NODE_ENV !== "production") return loadCaseCatalog();
  cached ??= loadCaseCatalog();
  return cached;
}

/** The case at /cases/<id>, or undefined. Fixtures are found by id, but never listed. */
export function getCase(id: string): Case | undefined {
  return getCaseCatalog().getCase(id);
}

/** Every playable case, in id order. */
export function listCases(): readonly Case[] {
  return getCaseCatalog().cases;
}
