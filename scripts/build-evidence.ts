/**
 * pnpm evidence:build [id…]   — build each case's evidence from its story and write it out
 * pnpm evidence:check [id…]   — build it and compare, without writing (CI runs this)
 *
 * Evidence is never written by hand (docs/plan/03-case-format-and-generator.md). A case YAML holds
 * the ground-truth story; the pure generator in `src/sim/evidence/generate` plays it and produces
 * the disk, memory and log evidence it would really have left. This script is the only place that
 * turns that into files:
 *
 *   src/content/evidence/<case>/evidence.json   the evidence set the game loads
 *   src/content/evidence/<case>/answers.json    the report's answer key, with its evidence
 *                                               patterns already resolved into artefact refs
 *
 * Both are written with sorted keys (`stableStringify`), so the same story always produces the
 * same bytes and `--check` can tell "somebody edited the story and forgot to rebuild" apart from
 * "the generator changed". The generator is seeded and pure, so there is nothing else it could be.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Case } from "@/content/cases/schema";
import {
  buildCase,
  CASES_DIR,
  CaseSourceError,
  loadCaseCatalog,
  type BuiltCase,
} from "@/features/cases/server";
import { stableStringify } from "@/sim";

const EVIDENCE_DIR = join(process.cwd(), "src", "content", "evidence");

const args = process.argv.slice(2);
const check = args.includes("--check");
const wanted = args.filter((arg) => !arg.startsWith("-"));

const catalog = load();
const cases = wanted.length === 0 ? catalog : catalog.filter((entry) => wanted.includes(entry.id));

if (cases.length === 0) {
  const known = catalog.map((entry) => entry.id).join(", ");
  fail(`No case matches ${wanted.join(", ")}. The cases are: ${known}.`);
}

const problems: string[] = [];
let changed = 0;

for (const entry of cases) {
  let built: BuiltCase;
  try {
    built = buildCase(entry);
  } catch (error) {
    if (!(error instanceof CaseSourceError)) throw error;
    problems.push(error.message);
    continue;
  }

  const files = {
    "evidence.json": `${stableStringify(built.evidence, 2)}\n`,
    "answers.json": `${stableStringify(answerKey(entry, built), 2)}\n`,
  };
  const dir = join(EVIDENCE_DIR, entry.id);
  const sizes: string[] = [];

  for (const [name, contents] of Object.entries(files)) {
    const path = join(dir, name);
    const before = read(path);
    if (before === contents) continue;
    changed++;
    if (check) {
      problems.push(
        before === undefined
          ? `${entry.id}/${name} has never been built. Run \`pnpm evidence:build\`.`
          : `${entry.id}/${name} is out of date: the story has changed since it was built. Run \`pnpm evidence:build\` and commit the result.`,
      );
      continue;
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, contents, "utf8");
    sizes.push(`${name} ${kb(contents)}`);
  }

  const { evidence } = built;
  const counts = [
    `${evidence.disks.length} disk${evidence.disks.length === 1 ? "" : "s"}`,
    `${evidence.logs.length} log records`,
    `${evidence.memory.length} memory capture${evidence.memory.length === 1 ? "" : "s"}`,
  ].join(", ");
  if (!check) {
    console.log(
      `${entry.id}: ${counts}${sizes.length > 0 ? ` (${sizes.join(", ")})` : " (unchanged)"}`,
    );
  }

  if (built.result.droppedSources.length > 0) {
    console.warn(
      `  ${entry.id}: the story writes to ${built.result.droppedSources.join(", ")}, which the case doesn't hand over, so those records were left out. Add them to evidence.logs if the player should see them.`,
    );
  }
}

// Evidence for a case that no longer exists would sit there for ever, and load.
const ids = new Set(catalog.map((entry) => entry.id));
for (const name of existing()) {
  if (ids.has(name)) continue;
  if (check) {
    problems.push(
      `src/content/evidence/${name} has no case any more. Run \`pnpm evidence:build\` to clear it out.`,
    );
    continue;
  }
  rmSync(join(EVIDENCE_DIR, name), { recursive: true, force: true });
  changed++;
  console.log(`${name}: removed (its case is gone)`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`\n${problem}`);
  fail(
    check
      ? "\nThe committed evidence isn't what the cases build today."
      : "\nSome cases couldn't be built.",
  );
}

console.log(
  check
    ? `Every case's evidence is what its story builds today (${cases.length} checked).`
    : changed === 0
      ? `Nothing changed (${cases.length} checked).`
      : `Built ${cases.length} case${cases.length === 1 ? "" : "s"}.`,
);

// ---------------------------------------------------------------------------------------------

function load(): Case[] {
  try {
    return [...loadCaseCatalog(CASES_DIR).all];
  } catch (error) {
    if (!(error instanceof CaseSourceError)) throw error;
    console.error(error.message);
    fail("\nFix the case file, then run this again.");
  }
}

/**
 * The answer key: each question's answer and the artefact refs its `acceptedEvidence` matched when
 * the evidence was built. Resolving the patterns here is what keeps a report honest — a question
 * that points at evidence which has moved fails the build instead of failing a player.
 */
function answerKey(entry: Case, built: BuiltCase) {
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

function read(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

function existing(): string[] {
  try {
    return readdirSync(EVIDENCE_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function kb(contents: string): string {
  return `${(Buffer.byteLength(contents) / 1024).toFixed(1)} KB`;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
