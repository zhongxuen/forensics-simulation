/**
 * pnpm case:new <id>
 *
 * Scaffolds a new case: `src/content/cases/<id>.yaml`, its playthrough in
 * `src/content/cases/playthroughs/<id>.yaml`, and the evidence its story builds. What it writes
 * already validates, generates and plays to the end, with every piece of copy marked TODO, so an
 * author starts from something that works and changes it a piece at a time rather than starting
 * from a blank file and a schema.
 *
 * The format is described in `src/content/cases/README.md`; the authoring checklist is in
 * `docs/plan/99-reference.md`. Modelled on `../hacker-simulation/scripts/mission-new.ts`.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { CASE_ID_PATTERN } from "@/content/cases/schema";
import {
  buildCase,
  CASE_FILE_EXTENSION,
  CASES_DIR,
  parseCaseSource,
  parsePlaythroughSource,
  PLAYTHROUGHS_DIR,
} from "@/features/cases/server";
import { caseTemplate, playthroughTemplate } from "./lib/case-template";
import { evidenceDirFor, writeEvidenceFiles } from "./lib/evidence-files";

const id = process.argv[2];
const where = (path: string) => relative(process.cwd(), path);

if (id === undefined || id.startsWith("-")) {
  fail("Give the new case's id, like: pnpm case:new case-04");
}
if (!CASE_ID_PATTERN.test(id)) {
  fail(
    `"${id}" can't be a case id. Use lowercase letters, digits and single hyphens, like case-04.`,
  );
}

const casePath = join(CASES_DIR, `${id}${CASE_FILE_EXTENSION}`);
const playPath = join(PLAYTHROUGHS_DIR, `${id}${CASE_FILE_EXTENSION}`);
if (existsSync(casePath)) {
  fail(`${where(casePath)} already exists. Pick another id, or edit that file.`);
}

const source = caseTemplate(id);
// The template must always validate and generate: if this throws, the template is broken, not the
// author's file. parseCaseSource plays the story and resolves the answer key as part of the check.
const entry = parseCaseSource(source, `${id}${CASE_FILE_EXTENSION}`);

const playSource = playthroughTemplate(id);
parsePlaythroughSource(playSource, `${id}${CASE_FILE_EXTENSION}`);

writeFileSync(casePath, source);
mkdirSync(PLAYTHROUGHS_DIR, { recursive: true });
if (!existsSync(playPath)) writeFileSync(playPath, playSource);
writeEvidenceFiles(buildCase(entry));

console.log(`Created ${where(casePath)}`);
console.log(`Created ${where(playPath)}`);
console.log(`Built   ${where(evidenceDirFor(id))}`);
console.log("");
console.log("Next:");
console.log("  1. Write the story first: everything else is checked against it.");
console.log("  2. Replace every TODO. src/content/cases/README.md walks through each field.");
console.log(`  3. pnpm evidence:build ${id}   rebuilds the evidence whenever the story changes`);
console.log(`  4. pnpm case:validate ${id}    checks the file, with readable errors`);
console.log(`  5. pnpm case:play ${id}        plays the playthrough and prints the transcript`);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
