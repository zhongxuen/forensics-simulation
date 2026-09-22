import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Phase 04 acceptance: 100% of src/sim imports in plain Node, with no DOM and no mocks.
const simRoot = fileURLToPath(new URL("../../src/sim", import.meta.url));

function engineModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return engineModules(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("src/sim is headless", () => {
  const modules = engineModules(simRoot);

  it("has modules to check", () => {
    expect(modules.length).toBeGreaterThan(20);
  });

  it.each(modules.map((path) => [relative(simRoot, path).replaceAll("\\", "/"), path]))(
    "imports %s with no DOM",
    async (_, path) => {
      expect(typeof window).toBe("undefined");
      await expect(import(/* @vite-ignore */ path)).resolves.toBeDefined();
    },
  );

  it("exposes the whole engine from @/sim", async () => {
    const sim = await import("@/sim");
    expect(typeof sim.step).toBe("function");
    expect(typeof sim.createInitialState).toBe("function");
    expect(typeof sim.replay).toBe("function");
    expect(sim.SIM_EVENT_TYPES).toContain("host.discovered");
    expect(sim.SIM_ERROR_CODES).toContain("HOST_UNREACHABLE");
    expect(sim.listTools().map((tool) => tool.name)).toContain("logview");
  });
});
