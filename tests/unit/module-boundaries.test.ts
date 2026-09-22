import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

// Lints in-memory snippets as if they lived at `filePath`, so the boundary rules in
// eslint.config.mjs stay proven without committing any violating file.
let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({ cwd: process.cwd() });
  // The first lint loads the config, plugins and import resolver; pay that cost once, here.
  await eslint.lintText("export {};\n", { filePath: "src/sim/core/warmup.ts" });
}, 60_000);

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((message) => message.ruleId ?? "fatal");
}

describe("src/sim boundaries", () => {
  const simFile = "src/sim/core/boundary-probe.ts";

  it("rejects React and Next.js imports", async () => {
    expect(await ruleIdsFor(simFile, 'import React from "react";\nexport { React };\n')).toContain(
      "no-restricted-imports",
    );
    expect(
      await ruleIdsFor(simFile, 'import Link from "next/link";\nexport { Link };\n'),
    ).toContain("no-restricted-imports");
  });

  it("rejects Node I/O imports", async () => {
    expect(
      await ruleIdsFor(
        simFile,
        'import { readFileSync } from "node:fs";\nexport { readFileSync };\n',
      ),
    ).toContain("no-restricted-imports");
    for (const specifier of ["fs", "fs/promises", "net", "http", "child_process"]) {
      expect(
        await ruleIdsFor(simFile, `import * as io from "${specifier}";\nexport { io };\n`),
        specifier,
      ).toContain("no-restricted-imports");
    }
  });

  it("rejects node:crypto, the bare crypto module and the crypto global", async () => {
    // Hashing runs in the browser too, so evidence hashes are pure TypeScript
    // (docs/plan/00-overview.md §4 row 5). The ban covers the new folders automatically.
    for (const file of [
      simFile,
      "src/sim/evidence/hash/probe.ts",
      "src/sim/tools/forensics/x.ts",
    ]) {
      for (const specifier of ["node:crypto", "crypto"]) {
        const [result] = await eslint.lintText(
          `import { createHash } from "${specifier}";\nexport { createHash };\n`,
          { filePath: file },
        );
        const messages = result?.messages ?? [];
        expect(
          messages.map((message) => message.ruleId),
          `${file} ${specifier}`,
        ).toContain("no-restricted-imports");
        expect(messages.map((message) => message.message).join("\n")).toContain(
          "src/sim/evidence/hash/",
        );
      }
    }
    expect(await ruleIdsFor(simFile, "export const id = () => crypto.randomUUID();\n")).toContain(
      "no-restricted-globals",
    );
  });

  it("allows the engine's own fs and net folders", async () => {
    const code =
      'export type { Vfs } from "../fs/types";\nexport type { Host } from "@/sim/net/types";\n';
    expect(await ruleIdsFor(simFile, code)).toEqual([]);
  });

  it("rejects imports from the rest of src", async () => {
    expect(
      await ruleIdsFor(simFile, 'import RootLayout from "@/app/layout";\nexport { RootLayout };\n'),
    ).toContain("import/no-restricted-paths");
  });

  it("rejects real time and randomness", async () => {
    const ids = await ruleIdsFor(
      simFile,
      "export const roll = () => Math.random() + Date.now() + new Date().getTime();\n",
    );
    expect(ids.filter((id) => id === "no-restricted-properties")).toHaveLength(2);
    expect(ids).toContain("no-restricted-syntax");
  });

  it("allows imports from inside src/sim", async () => {
    expect(await ruleIdsFor(simFile, 'export type {} from "@/sim/types";\n')).toEqual([]);
  });
});

describe("src/content boundaries", () => {
  const contentFile = "src/content/missions/boundary-probe.ts";

  it("allows @/sim/types", async () => {
    expect(await ruleIdsFor(contentFile, 'export type {} from "@/sim/types";\n')).toEqual([]);
  });

  it("rejects anything else in src", async () => {
    expect(
      await ruleIdsFor(
        contentFile,
        'import RootLayout from "@/app/layout";\nexport { RootLayout };\n',
      ),
    ).toContain("import/no-restricted-paths");
  });
});
