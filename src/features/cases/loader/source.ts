import { parse as parseYaml } from "yaml";
import { parseCase, type Case } from "@/content/cases/schema";
import { generate, GenerateError, requireAcceptedEvidence, EvidencePatternError } from "@/sim";
import type { EvidenceSet, GenerateResult } from "@/sim";
import { toCaseSpec } from "./spec";

/**
 * Reading one case file and checking everything that file alone decides (modelled on
 * `../hacker-simulation/src/features/missions/loader/source.ts`): the YAML, the schema, that the id
 * matches the file name, that the **story actually generates** — machines and accounts exist, files
 * are there to delete, a handed-over disk is not touched afterwards — and that every report
 * question's `acceptedEvidence` matches something in the evidence the story produced.
 *
 * That last check is the one that keeps a case honest as it is edited. Move a story action by an
 * hour and the answer key drifts; delete a file the report asks about and the question can never be
 * answered. Both stop the build here, with a message that names the case and what to fix.
 *
 * Checks that span cases (unique ids) belong to the catalog.
 */

/** A case file that can't be used, with a message naming the file and what to fix. */
export class CaseSourceError extends Error {
  constructor(
    readonly fileName: string,
    readonly problems: readonly string[],
  ) {
    super(`${fileName}:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    this.name = "CaseSourceError";
  }
}

/** Case files are YAML, named after the case's id: `case-01.yaml`. */
export const CASE_FILE_EXTENSION = ".yaml";

/** A case file starting with `_` is a fixture: it exercises the pipeline and is never played. */
export const FIXTURE_PREFIX = "_";

export interface CaseFile {
  readonly fileName: string;
  readonly case: Case;
}

/** A case, the evidence its story produces, and the trace that says which action left what. */
export interface BuiltCase {
  readonly case: Case;
  readonly evidence: EvidenceSet;
  readonly result: GenerateResult;
  /** Each report question's `acceptedEvidence`, resolved into the refs it matches today. */
  readonly acceptedRefs: ReadonlyMap<string, readonly string[]>;
}

/** Reads and checks one case file. Throws a `CaseSourceError` listing every problem in it. */
export function parseCaseSource(source: string, fileName: string): Case {
  let data: unknown;
  try {
    // A byte-order mark at the start of the file would otherwise become part of the first key.
    data = parseYaml(source.replace(/^﻿/, ""));
  } catch (error) {
    throw new CaseSourceError(fileName, [`The file isn't valid YAML: ${(error as Error).message}`]);
  }
  if (data === null || data === undefined) {
    throw new CaseSourceError(fileName, [
      "The file is empty. A case file starts with its id, version and title.",
    ]);
  }

  const result = parseCase(data);
  if (!result.success) throw new CaseSourceError(fileName, result.problems);
  const entry = result.case;

  const expectedId = fileName.slice(0, -CASE_FILE_EXTENSION.length);
  if (!fileName.endsWith(CASE_FILE_EXTENSION) || entry.id !== expectedId) {
    throw new CaseSourceError(fileName, [
      `id is "${entry.id}", but the file is named ${fileName}. Name the file ${entry.id}${CASE_FILE_EXTENSION}, or change the id to match.`,
    ]);
  }

  // Building the evidence is the real check: a story that can't be played is not a case.
  buildCase(entry, fileName);
  return entry;
}

/**
 * Plays a case's story and resolves its answer key. Separate from `parseCaseSource` so
 * `pnpm evidence:build` and the tests can keep the evidence instead of throwing it away.
 */
export function buildCase(entry: Case, fileName = `${entry.id}${CASE_FILE_EXTENSION}`): BuiltCase {
  let result: GenerateResult;
  try {
    result = generate(toCaseSpec(entry));
  } catch (error) {
    if (!(error instanceof GenerateError)) throw error;
    throw new CaseSourceError(fileName, [`the story can't be played: ${error.message}`]);
  }

  const acceptedRefs = new Map<string, readonly string[]>();
  const problems: string[] = [];
  for (const question of entry.report.questions) {
    try {
      acceptedRefs.set(
        question.id,
        requireAcceptedEvidence(
          result.evidence,
          question.acceptedEvidence,
          `report.questions[${question.id}].acceptedEvidence`,
        ),
      );
    } catch (error) {
      if (!(error instanceof EvidencePatternError)) throw error;
      problems.push(error.message);
    }
  }
  if (problems.length > 0) throw new CaseSourceError(fileName, problems);

  return { case: entry, evidence: result.evidence, result, acceptedRefs };
}
