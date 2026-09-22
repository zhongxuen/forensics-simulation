import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * No database, no accounts, no saved progress (standing decision in
 * md-files/00-overview-and-improvements.md; md-files/03-app-state-and-privacy.md). Adding a
 * database client, an auth library, or database credentials needs a new phase with its own
 * design, not a quiet dependency.
 */

const ROOT = join(import.meta.dirname, "../..");

const BANNED_PACKAGES = [
  /^@supabase\//,
  /^@?prisma(\/|$)/,
  /^drizzle-orm$/,
  /^(pg|postgres|mysql2?|sqlite3|better-sqlite3|mongodb|mongoose|redis|ioredis)$/,
  /^@neondatabase\//,
  /^@planetscale\//,
  /^@vercel\/(postgres|kv)$/,
  /^@upstash\/redis$/,
  /^firebase(-admin)?$/,
  /^next-auth$/,
  /^@auth\//,
  /^@clerk\//,
  /^better-auth$/,
  /^lucia$/,
];

const BANNED_ENV = /^\s*(DATABASE_URL|POSTGRES_\w+|SUPABASE_\w+|MONGODB_URI|REDIS_URL)\s*=/m;

describe("no database, no accounts", () => {
  it("has no database client or auth library in package.json", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as Record<
      string,
      Record<string, string> | undefined
    >;
    const dependencies = ["dependencies", "devDependencies", "optionalDependencies"].flatMap(
      (field) => Object.keys(pkg[field] ?? {}),
    );
    expect(
      dependencies.filter((name) => BANNED_PACKAGES.some((pattern) => pattern.test(name))),
    ).toEqual([]);
  });

  // Phase 11 (prompt 11.2): a database or auth library pulled in by another package counts too.
  it("has no database client or auth library anywhere in the lockfile", () => {
    const lock = readFileSync(join(ROOT, "pnpm-lock.yaml"), "utf8");
    const names = [...lock.matchAll(/^ {2}'?(@?[^@\s']+)@/gm)].map((match) => match[1]!);
    expect(names.length).toBeGreaterThan(100);
    expect(names.filter((name) => BANNED_PACKAGES.some((pattern) => pattern.test(name)))).toEqual(
      [],
    );
  });

  it("has no database credentials in any .env file", () => {
    const envFiles = readdirSync(ROOT).filter((name) => name.startsWith(".env"));
    expect(
      envFiles.filter((name) => BANNED_ENV.test(readFileSync(join(ROOT, name), "utf8"))),
    ).toEqual([]);
  });
});

/**
 * No cookie code (prompt 11.2): nothing sets, reads or clears a cookie on the server. The browser
 * side is tests/unit/storage-guard.test.ts. Lessons and the simulated web servers may show a
 * Set-Cookie header, because teaching what one is is part of the content, so src/content and
 * src/sim are left out: they're data, and never send a response.
 */
describe("no cookies", () => {
  const CODE_DIRS = ["src/app", "src/components", "src/features", "src/hooks", "src/lib"];

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
    });
  }

  /** Cookie code in one file: next/headers cookies(), `.cookies` on a request or response, or a Set-Cookie header. */
  function cookieCode(path: string): string[] {
    const file = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const found: string[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === "next/headers" &&
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings) &&
        node.importClause.namedBindings.elements.some((element) => element.name.text === "cookies")
      ) {
        found.push("cookies() from next/headers");
      } else if (ts.isPropertyAccessExpression(node) && node.name.text === "cookies") {
        found.push(".cookies");
      } else if (ts.isStringLiteralLike(node) && node.text.toLowerCase() === "set-cookie") {
        found.push("a Set-Cookie header");
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    return found;
  }

  it("sets, reads or clears no cookie anywhere in the app's code", () => {
    const offenders = CODE_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir))).flatMap((path) =>
      cookieCode(path).map((what) => `${relative(ROOT, path).replaceAll("\\", "/")}: ${what}`),
    );
    expect(offenders).toEqual([]);
  });
});
