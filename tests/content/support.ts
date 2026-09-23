import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Case } from "@/content/cases/schema";
import { parseCaseTime } from "@/content/cases/schema";
import { buildCase, loadCaseCatalog, type BuiltCase } from "@/features/cases/server";
import { formatInstant, resolveRef, stableStringify, type GenerateResult } from "@/sim";
import type { EvidenceSet, ResolvedArtefact } from "@/sim/types";

/**
 * What every case test shares: the catalog, the evidence committed beside each case, and the three
 * checks that hold a case to its own story (docs/plan/03-case-format-and-generator.md §Tests).
 *
 * The checks are written as functions returning problems rather than as assertions, for two
 * reasons: the group tests can assert there are none, and `case-failure-modes.test.ts` can edit a
 * story in memory and read back the message an author would actually see. A check nobody has
 * watched fail is a check nobody knows works.
 */

export const EVIDENCE_DIR = join(process.cwd(), "src", "content", "evidence");

export const catalog = loadCaseCatalog();

/** Every case, with its evidence played from its story, built once for the whole file. */
export const builtCases: readonly BuiltCase[] = catalog.all.map((entry) => buildCase(entry));

/** The evidence committed beside a case, as it ships. Undefined if it was never built. */
export function committedEvidence(caseId: string): EvidenceSet | undefined {
  const text = readIfThere(join(EVIDENCE_DIR, caseId, "evidence.json"));
  return text === undefined ? undefined : (JSON.parse(text) as EvidenceSet);
}

export function readIfThere(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Group 2 — consistency
// ---------------------------------------------------------------------------------------------

/**
 * Every artefact a story action left has to be in the evidence that ships, at the instant the
 * action happened. That is the whole contract between a story and its evidence: if it holds, the
 * two cannot disagree; if it breaks, either the story moved and nobody rebuilt, or an action is
 * writing down a different time from the one it claims.
 *
 * One artefact can be touched more than once — a browsing history is appended to all day, a file
 * is written and then deleted — and a file record keeps only the last of those times. So the rule
 * is: **the last action to touch an artefact is the one its times have to match**, and every
 * earlier touch has to have happened before it. A single missed rebuild still fails, and says
 * which action moved.
 *
 * Noise is checked the same way: seeded background activity that doesn't land where it says it
 * does would be just as wrong, and just as confusing to a player following a timeline.
 */
export function consistencyProblems(result: GenerateResult, evidence: EvidenceSet): string[] {
  const problems: string[] = [];

  /** Every touch of every artefact, in the order the actions ran. */
  const touches = new Map<string, { where: string; what: string; at: number }[]>();
  for (const entry of result.trace) {
    const where = `${entry.source}[${entry.id ?? entry.index}] ${entry.do} on ${entry.on} at ${formatInstant(entry.at)}`;
    for (const artefact of entry.artefacts) {
      const list = touches.get(artefact.ref) ?? [];
      list.push({ where, what: artefact.what, at: artefact.at });
      touches.set(artefact.ref, list);
    }
  }

  for (const [ref, list] of touches) {
    const resolved = resolveRef(evidence, ref);
    const last = list[list.length - 1];
    if (!last) continue;
    if (!resolved) {
      problems.push(
        `${last.where}: ${last.what} — ${ref} isn't in the evidence. Run \`pnpm evidence:build\`.`,
      );
      continue;
    }

    const instants = artefactInstants(resolved);
    if (instants.length === 0) continue;
    if (!instants.includes(last.at)) {
      problems.push(
        `${last.where}: ${last.what} — ${ref} records ${instants.map((at) => formatInstant(at)).join(", ")}, not ${formatInstant(last.at)}. Run \`pnpm evidence:build\`.`,
      );
      continue;
    }
    for (const touch of list.slice(0, -1)) {
      if (touch.at <= last.at) continue;
      problems.push(
        `${touch.where}: ${touch.what} — ${ref} was touched again at ${formatInstant(last.at)}, before this. The story is out of order.`,
      );
    }
  }
  return problems;
}

/** The instants an artefact records. Empty for a carved object, which carries no time of its own. */
function artefactInstants(resolved: ResolvedArtefact): number[] {
  switch (resolved.kind) {
    case "file": {
      const { m, a, c, b } = resolved.file.times;
      return [...new Set([m, a, c, b])];
    }
    case "log":
      return [resolved.record.at];
    case "process":
      return [resolved.process.createdAt];
    case "connection":
      return [resolved.connection.createdAt];
    case "carve":
    case "region":
      return [];
  }
}

// ---------------------------------------------------------------------------------------------
// Group 6 — answer integrity
// ---------------------------------------------------------------------------------------------

/**
 * A report question that names the story action deciding its answer (`answerFrom`) has to agree
 * with that action. Move the action and the answer key is wrong, which is the one kind of drift a
 * player would meet as "I read the evidence correctly and the game said no".
 */
export function answerIntegrityProblems(entry: Case): string[] {
  const problems: string[] = [];
  for (const question of entry.report.questions) {
    if (question.answerFrom === undefined) continue;
    const action = entry.story.find((item) => item.id === question.answerFrom);
    if (!action) {
      problems.push(
        `report.questions[${question.id}].answerFrom: no story action has the id "${question.answerFrom}".`,
      );
      continue;
    }
    if (question.type !== "timestamp") continue;

    const answered = parseCaseTime(question.answer);
    if (answered === undefined) {
      problems.push(`report.questions[${question.id}].answer: "${question.answer}" isn't a time.`);
      continue;
    }
    const drift = Math.abs(answered - action.at) / 1000;
    if (drift <= (question.toleranceSeconds ?? 0)) continue;
    problems.push(
      `report.questions[${question.id}]: the answer says ${formatInstant(answered)}, but the "${question.answerFrom}" action (${action.do} on ${action.on}) happens at ${formatInstant(action.at)} — ${Math.round(drift)}s apart, and the question allows ${question.toleranceSeconds ?? 0}s. Move the answer, or move the action.`,
    );
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Group 3 — staleness
// ---------------------------------------------------------------------------------------------

/** Whether what is committed beside a case is what its story builds today. */
export function stalenessProblems(built: BuiltCase, committed: string | undefined): string[] {
  const wanted = `${stableStringify(built.evidence, 2)}\n`;
  if (committed === undefined) {
    return [
      `src/content/evidence/${built.case.id}/evidence.json has never been built. Run \`pnpm evidence:build\`.`,
    ];
  }
  if (committed === wanted) return [];
  return [
    `src/content/evidence/${built.case.id}/evidence.json isn't what ${built.case.id}'s story builds today: the story has changed since it was built. Run \`pnpm evidence:build\` and commit the result.`,
  ];
}
