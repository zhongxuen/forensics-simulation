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
 *
 * What those two files hold lives in scripts/lib/evidence-files.ts, so `pnpm case:new` and
 * `pnpm case:validate` agree with this script about what "up to date" means.
 *
 * It also builds the lessons' practice evidence the same way: each story in
 * `src/content/practice/stories.ts` becomes `src/content/practice/<id>.evidence.json`. And the
 * sandbox's: `src/content/cases/sandbox.yaml` becomes `src/content/sandbox/evidence.json`.
 */
import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Case } from "@/content/cases/schema";
import { PRACTICE_STORIES } from "@/content/practice/stories";
import { generateEvidence, stableStringify } from "@/sim";
import {
  buildCase,
  buildSandbox,
  CASES_DIR,
  CaseSourceError,
  loadCaseCatalog,
  loadSandbox,
  SANDBOX_EVIDENCE_PATH,
  type BuiltCase,
} from "@/features/cases/server";
import {
  EVIDENCE_DIR,
  evidenceDirFor,
  evidenceFiles,
  readIfThere,
  writeEvidenceFiles,
} from "./lib/evidence-files";

/** Where the lessons' practice evidence is written, beside the stories it is built from. */
const PRACTICE_DIR = join(process.cwd(), "src", "content", "practice");

const args = process.argv.slice(2);
const check = args.includes("--check");
const wanted = args.filter((arg) => !arg.startsWith("-"));

const catalog = load();
const cases = wanted.length === 0 ? catalog : catalog.filter((entry) => wanted.includes(entry.id));
const practice =
  wanted.length === 0
    ? PRACTICE_STORIES
    : PRACTICE_STORIES.filter((story) => wanted.includes(story.id));
const withSandbox = wanted.length === 0 || wanted.includes("sandbox");

if (cases.length === 0 && practice.length === 0 && !withSandbox) {
  const known = [...catalog, ...PRACTICE_STORIES, { id: "sandbox" }]
    .map((entry) => entry.id)
    .join(", ");
  fail(`No case or practice story matches ${wanted.join(", ")}. They are: ${known}.`);
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

  const files = evidenceFiles(built);
  const dir = evidenceDirFor(entry.id);
  const sizes: string[] = [];

  if (check) {
    for (const [name, contents] of Object.entries(files)) {
      const before = readIfThere(join(dir, name));
      if (before === contents) continue;
      changed++;
      problems.push(
        before === undefined
          ? `${entry.id}/${name} has never been built. Run \`pnpm evidence:build\`.`
          : `${entry.id}/${name} is out of date: the story has changed since it was built. Run \`pnpm evidence:build\` and commit the result.`,
      );
    }
  } else {
    for (const name of writeEvidenceFiles(built)) {
      changed++;
      sizes.push(`${name} ${kb(files[name] ?? "")}`);
    }
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

// The lessons' practice evidence: one generated file per story, beside the stories.
for (const story of practice) {
  const path = join(PRACTICE_DIR, `${story.id}.evidence.json`);
  const contents = `${stableStringify(generateEvidence(story), 2)}\n`;
  const before = readIfThere(path);
  if (before === contents) continue;
  changed++;
  if (check) {
    problems.push(
      before === undefined
        ? `practice/${story.id}.evidence.json has never been built. Run \`pnpm evidence:build\`.`
        : `practice/${story.id}.evidence.json is out of date: its story has changed since it was built. Run \`pnpm evidence:build\` and commit the result.`,
    );
  } else {
    writeFileSync(path, contents, "utf8");
    console.log(`practice ${story.id}: ${kb(contents)}`);
  }
}

// Practice evidence whose story is gone would be loaded by nothing, and sit there for ever.
const storyIds = new Set(PRACTICE_STORIES.map((story) => story.id));
for (const name of readdirSync(PRACTICE_DIR)) {
  const id = /^(.+)\.evidence\.json$/.exec(name)?.[1];
  if (id === undefined || storyIds.has(id)) continue;
  if (check) {
    problems.push(
      `practice/${name} has no story any more. Run \`pnpm evidence:build\` to clear it out.`,
    );
    continue;
  }
  rmSync(join(PRACTICE_DIR, name));
  changed++;
  console.log(`practice ${id}: removed (its story is gone)`);
}

// The sandbox's evidence: one generated file, beside the workstation it is examined from.
if (withSandbox) {
  try {
    const contents = `${stableStringify(buildSandbox(loadSandbox()).evidence, 2)}\n`;
    const before = readIfThere(SANDBOX_EVIDENCE_PATH);
    if (before !== contents) {
      changed++;
      if (check) {
        problems.push(
          before === undefined
            ? "sandbox/evidence.json has never been built. Run `pnpm evidence:build`."
            : "sandbox/evidence.json is out of date: sandbox.yaml has changed since it was built. Run `pnpm evidence:build` and commit the result.",
        );
      } else {
        writeFileSync(SANDBOX_EVIDENCE_PATH, contents, "utf8");
        console.log(`sandbox: ${kb(contents)}`);
      }
    }
  } catch (error) {
    if (!(error instanceof CaseSourceError)) throw error;
    problems.push(error.message);
  }
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
    ? `Every case's evidence is what its story builds today (${cases.length} cases, ${practice.length} practice stories${withSandbox ? " and the sandbox" : ""} checked).`
    : changed === 0
      ? `Nothing changed (${cases.length} cases and ${practice.length} practice stories checked).`
      : `Built ${cases.length} case${cases.length === 1 ? "" : "s"} and ${practice.length} practice ${practice.length === 1 ? "story" : "stories"}.`,
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
