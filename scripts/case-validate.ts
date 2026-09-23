/**
 * pnpm case:validate [id…]
 *
 * Checks one case, several, or all of them, and lists every problem in words an author can act on:
 * the YAML and the schema, the story (the generator has to be able to play it), the accepted
 * evidence (every pattern has to match something), ids across the catalog, the lesson links, the
 * banned words from the voice rules, the committed evidence (is it what this story builds today?),
 * the playthrough (the case has to finish), and any TODO left over from `pnpm case:new`.
 *
 * Exits 1 if anything must be fixed. A leftover TODO is a warning, so `pnpm case:new demo &&
 * pnpm case:validate demo` works on a fresh scaffold; `--strict` turns warnings into failures, and
 * that is what CI runs, so no case ships with a TODO in it.
 *
 * Modelled on `../hacker-simulation/scripts/mission-validate.ts`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Case } from "@/content/cases/schema";
import { caseCopy } from "@/content/cases/copy";
import { findBannedWords } from "@/content/voice";
import {
  buildCase,
  buildCaseCatalog,
  CASE_FILE_EXTENSION,
  CASES_DIR,
  CaseSourceError,
  loadPlaythrough,
  parseCaseSource,
  playthroughPath,
  verifyPlaythrough,
  type BuiltCase,
} from "@/features/cases/server";
import { evidenceDirFor, evidenceFiles, readIfThere } from "./lib/evidence-files";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const wanted = args.filter((arg) => !arg.startsWith("-"));
const files = readdirSync(CASES_DIR)
  .filter((name) => name.endsWith(CASE_FILE_EXTENSION))
  .sort();

const parsed = new Map<string, Case>();
const problems = new Map<string, string[]>();
const warnings = new Map<string, string[]>();
const add = (map: Map<string, string[]>, file: string, line: string) =>
  map.set(file, [...(map.get(file) ?? []), line]);

for (const file of files) {
  try {
    parsed.set(file, parseCaseSource(readFileSync(join(CASES_DIR, file), "utf8"), file));
  } catch (error) {
    if (!(error instanceof CaseSourceError)) throw error;
    for (const problem of error.problems) add(problems, file, problem);
  }
}

// What no single file can decide: that ids are unique across the catalog.
try {
  buildCaseCatalog([...parsed].map(([fileName, entry]) => ({ fileName, case: entry })));
} catch (error) {
  if (!(error instanceof CaseSourceError)) throw error;
  for (const problem of error.problems) add(problems, error.fileName, problem);
}

// Lesson ids are their file names (the lesson loader enforces it). Reading the names keeps this
// script clear of the MDX compiler, which only loads as an ES module.
const lessonIds = new Set(
  readdirSync(join(process.cwd(), "src", "content", "lessons"))
    .filter((name) => name.endsWith(".mdx"))
    .map((name) => name.slice(0, -".mdx".length)),
);

for (const [file, entry] of parsed) {
  for (const [where, ids] of [
    ["concepts", entry.concepts],
    ["debrief.furtherReading", entry.debrief.furtherReading],
  ] as const) {
    for (const id of ids) {
      if (!lessonIds.has(id))
        add(problems, file, `${where}: there's no lesson with the id "${id}".`);
    }
  }

  for (const { path, text } of caseCopy(entry)) {
    for (const word of findBannedWords(text)) {
      add(problems, file, `${path}: "${word}" is on the banned list (docs/plan/99-reference.md).`);
    }
  }

  let built: BuiltCase | undefined;
  try {
    built = buildCase(entry, file);
  } catch (error) {
    if (!(error instanceof CaseSourceError)) throw error;
    for (const problem of error.problems) add(problems, file, problem);
  }

  if (built) {
    const committed = readIfThere(join(evidenceDirFor(entry.id), "evidence.json"));
    if (committed === undefined) {
      add(problems, file, "its evidence has never been built. Run `pnpm evidence:build`.");
    } else if (committed !== evidenceFiles(built)["evidence.json"]) {
      add(
        problems,
        file,
        "the committed evidence isn't what this story builds today. Run `pnpm evidence:build` and commit the result.",
      );
    }

    const playthrough = (() => {
      try {
        return loadPlaythrough(entry.id, entry.playthrough);
      } catch (error) {
        if (!(error instanceof CaseSourceError)) throw error;
        for (const problem of error.problems) add(problems, file, `playthrough: ${problem}`);
        return null;
      }
    })();
    if (playthrough === undefined) {
      add(
        problems,
        file,
        `There's no playthrough, so nothing proves this case can be finished. Add ${playthroughPath(entry.id, entry.playthrough)} (pnpm case:new writes one).`,
      );
    } else if (playthrough) {
      for (const problem of verifyPlaythrough(built, playthrough).problems) {
        add(problems, file, `playthrough: ${problem}`);
      }
    }
  }

  const todos = readFileSync(join(CASES_DIR, file), "utf8")
    .split("\n")
    .flatMap((line, index) => (/\bTODO\b/.test(line) ? [index + 1] : []));
  if (todos.length > 0) {
    add(
      warnings,
      file,
      `${todos.length} TODO${todos.length === 1 ? "" : "s"} left, on line${todos.length === 1 ? "" : "s"} ${todos.join(", ")}. CI won't ship a case with a TODO in it.`,
    );
  }
}

const selected = files.filter(
  (file) => wanted.length === 0 || wanted.includes(file.slice(0, -CASE_FILE_EXTENSION.length)),
);
const unknown = wanted.filter((id) => !files.includes(`${id}${CASE_FILE_EXTENSION}`));
for (const id of unknown) {
  console.log(`✗ ${id}: there's no case with that id in src/content/cases.`);
}

let failed = unknown.length > 0;
for (const file of selected) {
  const fileProblems = problems.get(file) ?? [];
  const fileWarnings = warnings.get(file) ?? [];
  const todoOnly = fileProblems.length === 0 && fileWarnings.length > 0;
  console.log(`${fileProblems.length > 0 ? "✗" : todoOnly ? "!" : "✓"} ${file}`);
  for (const problem of fileProblems) console.log(`    - ${problem}`);
  for (const warning of fileWarnings) console.log(`    ! ${warning}`);
  if (fileProblems.length > 0 || (strict && fileWarnings.length > 0)) failed = true;
}

console.log("");
console.log(
  failed
    ? "Some cases need fixing. Each line above says where the problem is and what to change."
    : `All ${selected.length} ${selected.length === 1 ? "case is" : "cases are"} valid, and each one plays to the end.`,
);
process.exit(failed ? 1 : 0);
