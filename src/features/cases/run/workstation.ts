import { attachEvidence, browseImage, scenarioStartMs } from "@/sim";
import type { BrowsedImage, EvidenceSet, ScenarioSpec, SimState } from "@/sim/types";
import type { SessionSetup } from "@/features/terminal";

/**
 * What the workstation starts with on top of its scenario: the case's evidence, attached as
 * devices under /dev/evidence with every write-blocker on (src/sim/evidence/session.ts). It runs
 * again on Reset machine, which is what undoes a read with the blocker off.
 */
export function evidenceSetup(scenario: ScenarioSpec, evidence: EvidenceSet): SessionSetup {
  const now = scenarioStartMs(scenario);
  return (sim) => attachEvidence(sim, evidence, { now });
}

/**
 * Opens an image for the Evidence Browser through the engine, as a terminal session's `apply`
 * change: the same call on the live workstation and in a replayed save. Undefined when there was
 * nothing to open, which changes nothing.
 */
export function browseChange(
  path: string,
): (sim: SimState, now: number) => BrowsedImage | undefined {
  return (sim, now) => {
    const opened = browseImage(sim, path, now);
    return opened.ok ? opened.value : undefined;
  };
}
