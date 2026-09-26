/**
 * pnpm case:play <id> [--script <file>]
 * pnpm case:play <id> --run "<command>" [--pin <pattern>] [--report <question>=<answer>]
 *                     [--cite <pattern>] [--answer <objective>=<text>] [--reset]
 *
 * `--cite` adds a pinned pattern to the report answer before it: an answer is only supported
 * when something it cites proves it.
 *
 * Plays a case headlessly, through the same parser, engine and tool registry as the browser, and
 * prints the transcript: every command with its output, every objective as it ticks, every story
 * beat, and each report question's verdict at the end.
 *
 * With no options it plays the case's playthrough (src/content/cases/playthroughs/<id>.yaml) and
 * checks it, exiting 1 if the case no longer goes as written — which is what makes a case's
 * solvability something CI can hold on to. With steps on the command line it plays those instead,
 * in the order given, for trying things out while writing a case.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { Playthrough, PlaythroughStep } from "@/content/cases/playthrough";
import {
  buildCase,
  CaseSourceError,
  formatCasePlay,
  getCase,
  loadPlaythrough,
  parsePlaythroughSource,
  playCase,
  playthroughPath,
  verifyPlaythrough,
} from "@/features/cases/server";

const args = process.argv.slice(2);
const id = args.find((arg, index) => !arg.startsWith("-") && !args[index - 1]?.startsWith("--"));
if (id === undefined) {
  fail('Give the case to play, like: pnpm case:play _fixture (or add --run "ls").');
}

const entry = (() => {
  try {
    return getCase(id);
  } catch (error) {
    if (!(error instanceof CaseSourceError)) throw error;
    console.error(`${error.message}\n`);
    fail(`Fix the case first: pnpm case:validate ${id}`);
  }
})();
if (!entry) fail(`There's no case with the id "${id}" in src/content/cases.`);

const built = buildCase(entry);

// Steps typed on the command line, in the order they were given.
const steps: PlaythroughStep[] = [];
let scriptPath: string | undefined;
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  const value = args[index + 1];
  if (arg === "--run" && value !== undefined) {
    steps.push({ run: value });
    index++;
  } else if (arg === "--pin" && value !== undefined) {
    steps.push({ pin: value });
    index++;
  } else if (arg === "--report" && value !== undefined) {
    const [question = "", ...rest] = value.split("=");
    steps.push({ report: question, answer: rest.join("="), verdict: "supported" });
    index++;
  } else if (arg === "--cite" && value !== undefined) {
    const last = steps.at(-1);
    if (last && "report" in last)
      steps[steps.length - 1] = { ...last, cite: [...(last.cite ?? []), value] };
    else fail("Put --cite after the --report answer it supports.");
    index++;
  } else if (arg === "--answer" && value !== undefined) {
    const [objective = "", ...rest] = value.split("=");
    steps.push({ objective, answer: rest.join("="), accepted: true });
    index++;
  } else if (arg === "--reset") {
    steps.push({ reset: true });
  } else if (arg === "--script" && value !== undefined) {
    scriptPath = value;
    index++;
  }
}

if (steps.length > 0) {
  // Trying things out: play exactly the steps given, and show what happened.
  console.log(formatCasePlay(playCase(built, steps)));
  process.exit(0);
}

let playthrough: Playthrough | undefined;
try {
  playthrough = scriptPath
    ? parsePlaythroughSource(readFileSync(scriptPath, "utf8"), basename(scriptPath), entry.id)
    : loadPlaythrough(entry.id, entry.playthrough);
} catch (error) {
  if (!(error instanceof CaseSourceError)) throw error;
  console.error(error.message);
  process.exit(1);
}
if (!playthrough) {
  fail(
    `${entry.id} has no playthrough yet. Add ${playthroughPath(entry.id, entry.playthrough)}, or pass steps with --run "<command>".`,
  );
}

const { result, problems } = verifyPlaythrough(built, playthrough);
console.log(formatCasePlay(result));
if (problems.length > 0) {
  console.log("\nThe playthrough didn't go as written:");
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(1);
}
console.log("\nThe playthrough went exactly as written.");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
