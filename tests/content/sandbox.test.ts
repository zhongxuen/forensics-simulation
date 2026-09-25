import { describe, expect, it } from "vitest";
import { findBannedWords } from "@/content/voice";
import {
  buildSandbox,
  CaseSourceError,
  getCaseCatalog,
  loadSandbox,
  SANDBOX_EVIDENCE_PATH,
  sandboxWorkstation,
} from "@/features/cases/server";
import { createTerminalSession, submitLine } from "@/features/terminal";
import { attachEvidence, EvidenceSetSchema, stableStringify } from "@/sim";
import { readIfThere } from "./support";

/**
 * The sandbox (src/content/cases/sandbox.yaml, docs/plan/15-quality-and-launch.md part B): the
 * same guarantees as a case's evidence — committed, current, deterministic, well formed — and the
 * spec's promise that it holds a bit of everything: deleted and carvable files on a disk, a memory
 * image, and every log source a story can write. Then every command the page suggests is run
 * through the engine, so "Try this first" never suggests something that fails.
 */

const sandbox = loadSandbox();
const built = buildSandbox(sandbox);
const { evidence } = built;

describe("the sandbox", () => {
  it("is not a case: the catalog leaves it out", () => {
    expect(getCaseCatalog().all.map((entry) => entry.id)).not.toContain("sandbox");
  });

  it("has the evidence committed beside the workstation that its story builds today", () => {
    expect(
      readIfThere(SANDBOX_EVIDENCE_PATH),
      "sandbox/evidence.json is missing or out of date. Run `pnpm evidence:build`.",
    ).toBe(`${stableStringify(evidence, 2)}\n`);
  });

  it("builds the same bytes every time, and matches the evidence model", () => {
    expect(stableStringify(buildSandbox(loadSandbox()).evidence)).toBe(stableStringify(evidence));
    expect(EvidenceSetSchema.safeParse(evidence).success).toBe(true);
  });

  it("hands over everything its story writes", () => {
    expect(built.droppedSources).toEqual([]);
  });

  it("holds a disk with deleted files, a memory image and every log source a story can write", () => {
    const [disk] = evidence.disks;
    expect(disk?.records.filter((record) => record.deleted).length).toBeGreaterThanOrEqual(3);
    expect(disk?.unallocatedB64.length).toBeGreaterThan(0);

    const [memory] = evidence.memory;
    expect(memory?.processes.some((process) => process.unlinked === true)).toBe(true);
    expect(memory?.regions.length).toBeGreaterThanOrEqual(2);
    expect(memory?.connections.length).toBeGreaterThan(0);

    // `vpn` is the one source no story action writes yet (sandbox.yaml's header says so).
    const sources = new Set(evidence.logs.map((record) => record.source));
    expect([...sources].sort()).toEqual([
      "dns",
      "firewall",
      "security",
      "sysmon-lite",
      "web-access",
    ]);
  });

  it("follows the voice rules", () => {
    for (const line of [
      sandbox.title,
      sandbox.banner,
      sandbox.summary,
      ...sandbox.tryThis.map((idea) => idea.why),
    ]) {
      expect(findBannedWords(line), line).toEqual([]);
    }
    expect(sandbox.banner).toBe("No goals here. Try any tool on anything.");
  });

  it("runs every command it suggests, in order, on its own workstation", () => {
    const { scenario, seed, startsAt } = sandboxWorkstation(sandbox, evidence);
    let session = createTerminalSession({
      scenario,
      seed,
      setup: (sim) => attachEvidence(sim, evidence, { now: startsAt }),
    });
    for (const { command } of sandbox.tryThis) {
      session = submitLine(session, command);
      expect(session.blocks.at(-1)?.exitCode, command).toBe(0);
    }
  });

  it("says what's wrong with a sandbox file that can't be used", () => {
    expect(() => loadSandbox("does-not-exist.yaml")).toThrow();
    const error = new CaseSourceError("sandbox.yaml", ["id: must be sandbox"]);
    expect(error.message).toContain("sandbox.yaml");
  });
});
