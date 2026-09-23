import type { EvidenceSet } from "@/sim/types";

/**
 * Each case's evidence, loaded with a dynamic `import()` so it's never in a page's first download
 * (00 §4 row 12). File 03 adds `loadEvidence(caseId)` over the generated JSON in
 * `src/content/evidence/<case>/`; until then only the practice case has evidence, from the
 * builder. Add a case here with one line.
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
