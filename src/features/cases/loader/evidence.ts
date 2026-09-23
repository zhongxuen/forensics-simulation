import type { ArtefactRef, EvidenceSet } from "@/sim/types";

/**
 * Loading a case's evidence in the browser (docs/plan/00-overview.md §4, row 12).
 *
 * Evidence is generated at build time and committed as JSON, and a case's set is a few hundred
 * kilobytes — far more than a page's whole JavaScript budget. So it is never imported statically:
 * `loadEvidence` uses a dynamic `import()`, which makes each case's evidence its own chunk,
 * fetched the moment the workspace opens it and never before. `pnpm bundle:check` is what stops
 * that quietly regressing.
 *
 * The import path is built from the case id, so the bundler makes one chunk per file under
 * `src/content/evidence`. Nothing else in this module touches the filesystem or the network, so it
 * is safe in a client component.
 */

/** The answer key for one report question, with its evidence patterns already resolved. */
export interface ReportAnswer {
  readonly id: string;
  readonly type: string;
  readonly answer: string;
  /** For a timestamp answer: the instant it means. */
  readonly answerAt?: number;
  readonly toleranceSeconds?: number;
  /** Every artefact an answer may point at, resolved when the evidence was built. */
  readonly acceptedRefs: readonly ArtefactRef[];
}

/** What `src/content/evidence/<case>/answers.json` holds. */
export interface ReportAnswers {
  readonly caseId: string;
  /** The case `version` this key was built from, so a stale saved run can be spotted. */
  readonly version: number;
  readonly questions: readonly ReportAnswer[];
}

/** A case whose evidence hasn't been built, or whose id is not a case. */
export class EvidenceNotBuiltError extends Error {
  constructor(readonly caseId: string) {
    super(
      `There is no built evidence for "${caseId}". Run \`pnpm evidence:build\` to build it from the case's story.`,
    );
    this.name = "EvidenceNotBuiltError";
  }
}

const CASE_ID = /^_?[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** One case's evidence, fetched as its own chunk. Checked against the schema in development. */
export async function loadEvidence(caseId: string): Promise<EvidenceSet> {
  const loaded = await loadJson<EvidenceSet>(caseId, "evidence");
  if (process.env.NODE_ENV !== "production") {
    // Only in development, and behind a dynamic import, so neither the schema nor the time it
    // takes to run reaches a production page.
    const { EvidenceSetSchema } = await import("@/sim");
    const checked = EvidenceSetSchema.safeParse(loaded);
    if (!checked.success) {
      throw new Error(
        `The built evidence for "${caseId}" doesn't match the evidence model. Rebuild it with \`pnpm evidence:build\`.\n${checked.error.message}`,
      );
    }
  }
  return loaded;
}

/** One case's answer key. Small, and a separate chunk from the evidence. */
export async function loadReportAnswers(caseId: string): Promise<ReportAnswers> {
  return loadJson<ReportAnswers>(caseId, "answers");
}

async function loadJson<T>(caseId: string, name: "evidence" | "answers"): Promise<T> {
  if (!CASE_ID.test(caseId)) throw new EvidenceNotBuiltError(caseId);
  try {
    const loaded: unknown = await import(`../../../content/evidence/${caseId}/${name}.json`);
    // A JSON module is the value itself under `default`, whichever way the bundler wrapped it.
    return (isModule(loaded) ? loaded.default : loaded) as T;
  } catch {
    throw new EvidenceNotBuiltError(caseId);
  }
}

function isModule(value: unknown): value is { default: unknown } {
  return typeof value === "object" && value !== null && "default" in value;
}
