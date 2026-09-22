import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeBase64, encodeBase64, isBase64 } from "@/sim";

// ESLint already bans Date.now, Math.random, argument-less new Date and Node modules in src/sim.
// Intl isn't a lint rule, so this test keeps it out: its output depends on the machine's locale
// and time-zone database. Zone offsets come from the committed table in src/sim/evidence/time.ts.
const simRoot = fileURLToPath(new URL("../../src/sim", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("src/sim stays machine-independent", () => {
  it.each(sources(simRoot).map((path) => [relative(simRoot, path).replaceAll("\\", "/"), path]))(
    "%s uses no Intl or locale-dependent formatting",
    (_, path) => {
      // Comments may mention Intl (time.ts explains why it isn't used); code may not.
      const code = readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
      expect(code).not.toMatch(/\bIntl\b/);
      expect(code).not.toMatch(/\.toLocale(String|DateString|TimeString|LowerCase|UpperCase)\(/);
      expect(code).not.toMatch(/\.localeCompare\(/);
    },
  );
});

describe("base64", () => {
  it("matches Node's encoder and decoder on every length up to 64 bytes", () => {
    for (let length = 0; length <= 64; length++) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + length * 11) % 256);
      const expected = Buffer.from(bytes).toString("base64");
      expect(encodeBase64(bytes)).toBe(expected);
      expect(isBase64(expected)).toBe(true);
      expect(Array.from(decodeBase64(expected))).toEqual(Array.from(bytes));
    }
  });

  it.each(["abc", "ab=c", "a===", "ab cd", "ab-_"])("rejects %j", (text) => {
    expect(isBase64(text)).toBe(false);
    expect(() => decodeBase64(text)).toThrow(TypeError);
  });
});
