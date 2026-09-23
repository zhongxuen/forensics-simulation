import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parsePlaythrough, type Playthrough } from "@/content/cases/playthrough";
import { CASES_DIR } from "./catalog";
import { CASE_FILE_EXTENSION, CaseSourceError } from "./source";

/**
 * Reading a case's playthrough: the scripted run that proves the case can be finished
 * (docs/plan/03-case-format-and-generator.md §Tests, group 5). One file per case, named after it,
 * unless the case's `playthrough:` field says otherwise.
 *
 * Server only: it reads files with Node's fs.
 */

/** Where playthroughs live: `src/content/cases/playthroughs/case-01.yaml`. */
export const PLAYTHROUGHS_DIR = join(CASES_DIR, "playthroughs");

/**
 * Where a case's playthrough should be, whether or not it is there yet. `where` is a case's own
 * `playthrough:` field, a path relative to `src/content/cases`.
 */
export function playthroughPath(caseId: string, where?: string): string {
  if (where === undefined) return join(PLAYTHROUGHS_DIR, `${caseId}${CASE_FILE_EXTENSION}`);
  return resolve(CASES_DIR, where);
}

/**
 * Reads and checks one playthrough file. Throws a `CaseSourceError` listing every problem. The
 * `case:` field has to name the case it plays: whichever file it is in, a playthrough that has
 * drifted onto another case would silently stop testing the one it was written for.
 */
export function parsePlaythroughSource(
  source: string,
  fileName: string,
  expectedCase?: string,
): Playthrough {
  let data: unknown;
  try {
    data = parseYaml(source.replace(/^﻿/, ""));
  } catch (error) {
    throw new CaseSourceError(fileName, [`The file isn't valid YAML: ${(error as Error).message}`]);
  }
  if (data === null || data === undefined) {
    throw new CaseSourceError(fileName, [
      "The file is empty. A playthrough starts with the case it plays, then its steps.",
    ]);
  }
  const result = parsePlaythrough(data);
  if (!result.success) throw new CaseSourceError(fileName, result.problems);

  const wanted = expectedCase ?? fileName.replace(new RegExp(`${CASE_FILE_EXTENSION}$`), "");
  if (result.playthrough.case !== wanted) {
    throw new CaseSourceError(fileName, [
      `case is "${result.playthrough.case}", but this is ${wanted}'s playthrough. A playthrough is named after the case it plays.`,
    ]);
  }
  return result.playthrough;
}

/** A case's playthrough, or undefined when it doesn't have one yet. */
export function loadPlaythrough(caseId: string, where?: string): Playthrough | undefined {
  const path = playthroughPath(caseId, where);
  if (!existsSync(path)) return undefined;
  const name = where ?? `${caseId}${CASE_FILE_EXTENSION}`;
  return parsePlaythroughSource(readFileSync(path, "utf8"), name, caseId);
}
