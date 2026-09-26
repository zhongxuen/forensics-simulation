import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseSandbox, SANDBOX_FILE, type Sandbox } from "@/content/cases/schema";
import { generate, GenerateError, type CaseSpec, type GenerateResult } from "@/sim";
import type { EvidenceSet, FsEntrySpec, Instant, ScenarioSpec } from "@/sim/types";
import { CASES_DIR } from "./catalog";
import { handoverForm, workstationWith } from "./scenario";
import { CaseSourceError } from "./source";

/**
 * The sandbox (docs/plan/15-quality-and-launch.md, part B): `src/content/cases/sandbox.yaml`, a
 * story with no goals, played by the same generator as a case into
 * `src/content/sandbox/evidence.json`, which `/sandbox` attaches to the workstation on demand.
 *
 * It sits beside the cases because it is written the same way, but it is not one: the case catalog
 * skips its file, and nothing here asks, grades or saves anything.
 */

export const SANDBOX_PATH = join(CASES_DIR, SANDBOX_FILE);

/** Where the sandbox's evidence is written, beside the workstation it is examined from. */
export const SANDBOX_EVIDENCE_PATH = join(
  process.cwd(),
  "src",
  "content",
  "sandbox",
  "evidence.json",
);

/** The sandbox's folder on the workstation, where the terminal opens. */
export const SANDBOX_DIR = "/home/examiner/cases/sandbox";

/** Reads and checks `sandbox.yaml`. Throws a `CaseSourceError` listing every problem in it. */
export function loadSandbox(path: string = SANDBOX_PATH): Sandbox {
  let data: unknown;
  try {
    data = parseYaml(readFileSync(path, "utf8").replace(/^﻿/, ""));
  } catch (error) {
    throw new CaseSourceError(SANDBOX_FILE, [
      `The file isn't valid YAML: ${(error as Error).message}`,
    ]);
  }
  const result = parseSandbox(data);
  if (!result.success) throw new CaseSourceError(SANDBOX_FILE, result.problems);
  return result.sandbox;
}

/** The generator's input for the sandbox: the same shape a case's story becomes. */
export function sandboxSpec(sandbox: Sandbox): CaseSpec {
  return {
    id: sandbox.id,
    seed: sandbox.seed,
    machines: sandbox.machines,
    story: sandbox.story,
    ...(sandbox.noise === undefined ? {} : { noise: sandbox.noise }),
    evidence: sandbox.evidence,
  };
}

/** Plays the sandbox's story. Throws a `CaseSourceError` when it can't be played. */
export function buildSandbox(sandbox: Sandbox): GenerateResult {
  try {
    return generate(sandboxSpec(sandbox));
  } catch (error) {
    if (!(error instanceof GenerateError)) throw error;
    throw new CaseSourceError(SANDBOX_FILE, [`the story can't be played: ${error.message}`]);
  }
}

export interface SandboxWorkstation {
  readonly scenario: ScenarioSpec;
  readonly seed: number;
  /** When the examiner sits down: the moment the kit was handed over. */
  readonly startsAt: Instant;
}

/**
 * The workstation for the sandbox: the case workstation, with a folder holding what the kit
 * arrived with (a short note and the handover form) and the two empty folders the disk tools write
 * into. The evidence itself is attached as devices, as in a case.
 */
export function sandboxWorkstation(sandbox: Sandbox, evidence: EvidenceSet): SandboxWorkstation {
  const received = evidence.handover.map((item) => item.receivedAt);
  const startsAt =
    received.length > 0
      ? Math.max(...received)
      : Math.max(...sandbox.story.map((action) => action.at));
  const files: FsEntrySpec[] = [
    { path: `${SANDBOX_DIR}/about.txt`, content: aboutText(sandbox) },
    {
      path: `${SANDBOX_DIR}/handover.txt`,
      content: handoverForm("Candlewright training", evidence),
    },
    { path: `${SANDBOX_DIR}/images`, type: "dir" },
    { path: `${SANDBOX_DIR}/export`, type: "dir" },
  ];
  return {
    seed: sandbox.seed,
    startsAt,
    scenario: workstationWith("sandbox-kit", startsAt, SANDBOX_DIR, files),
  };
}

function aboutText(sandbox: Sandbox): string {
  return [
    sandbox.title,
    "",
    sandbox.banner,
    "",
    sandbox.summary.trim(),
    "",
    "Some things to try:",
    ...sandbox.tryThis.map((idea) => `  ${idea.command}`),
    "",
  ].join("\n");
}
