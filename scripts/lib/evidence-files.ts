import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BuiltCase } from "@/features/cases/server";
import { stableStringify } from "@/sim";

/**
 * The two files a case's built evidence becomes, and where they go. One place decides it, so
 * `pnpm evidence:build`, `pnpm evidence:check`, `pnpm case:new` and `pnpm case:validate` can never
 * disagree about what "up to date" means.
 *
 *   src/content/evidence/<case>/evidence.json   the evidence set the game loads
 *   src/content/evidence/<case>/answers.json    the report's answer key, with its evidence
 *                                               patterns already resolved into artefact refs
 *
 * Both are written with sorted keys (`stableStringify`), so the same story always produces the
 * same bytes.
 */

export const EVIDENCE_DIR = join(process.cwd(), "src", "content", "evidence");

/** Where one case's evidence lives. */
export const evidenceDirFor = (caseId: string): string => join(EVIDENCE_DIR, caseId);

/** What a case's evidence folder should contain today, by file name. */
export function evidenceFiles(built: BuiltCase): Record<string, string> {
  return {
    "evidence.json": `${stableStringify(built.evidence, 2)}\n`,
    "answers.json": `${stableStringify(answerKey(built), 2)}\n`,
  };
}

/** Writes them, and says which ones changed. */
export function writeEvidenceFiles(built: BuiltCase): string[] {
  const dir = evidenceDirFor(built.case.id);
  const changed: string[] = [];
  for (const [name, contents] of Object.entries(evidenceFiles(built))) {
    const path = join(dir, name);
    if (readIfThere(path) === contents) continue;
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, contents, "utf8");
    changed.push(name);
  }
  return changed;
}

export function readIfThere(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * The answer key: each question's answer and the artefact refs its `acceptedEvidence` matched when
 * the evidence was built. Resolving the patterns here is what keeps a report honest — a question
 * that points at evidence which has moved fails the build instead of failing a player.
 */
function answerKey(built: BuiltCase) {
  const entry = built.case;
  return {
    caseId: entry.id,
    version: entry.version,
    questions: entry.report.questions.map((question) => ({
      id: question.id,
      type: question.type,
      answer: question.answer,
      ...("answerAt" in question ? { answerAt: question.answerAt } : {}),
      ...(question.toleranceSeconds === undefined
        ? {}
        : { toleranceSeconds: question.toleranceSeconds }),
      acceptedRefs: built.acceptedRefs.get(question.id) ?? [],
    })),
  };
}
