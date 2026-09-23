import type { EvidenceSet } from "@/sim/types";

/**
 * Each case's evidence, loaded with a dynamic `import()` so it's never in a page's first download
 * (00 §4 row 12). File 03 adds `loadEvidence(caseId)` over the generated JSON in
 * `src/content/evidence/<case>/`; until then only the practice case has evidence, from the
 * builder. Add a case here with one line.
 *
 * Nothing here imports the engine, so the case page can warm the evidence up during the briefing
 * without the engine joining its first download.
 */
const LOADERS: Readonly<Record<string, () => Promise<EvidenceSet>>> = {
  practice: () => import("./practice-evidence").then((module) => module.PRACTICE_EVIDENCE),
};

/** The case's evidence, or undefined for a case that has none yet. */
export function loadCaseEvidence(caseId: string): Promise<EvidenceSet> | undefined {
  return Object.hasOwn(LOADERS, caseId) ? LOADERS[caseId]?.() : undefined;
}

/** Whether the case has evidence to load. */
export const hasCaseEvidence = (caseId: string): boolean => Object.hasOwn(LOADERS, caseId);

const pending = new Map<string, Promise<EvidenceSet | null>>();

/**
 * The case's evidence, or null for a case with none (or whose evidence didn't load), as one
 * promise per case that every caller shares: the runner warms it up during the briefing, and the
 * play chunk waits on the same download (React's `use`) before it starts the workstation.
 */
export function caseEvidence(caseId: string): Promise<EvidenceSet | null> {
  let promise = pending.get(caseId);
  if (!promise) {
    promise = loadCaseEvidence(caseId)?.catch(() => null) ?? Promise.resolve(null);
    pending.set(caseId, promise);
  }
  return promise;
}
