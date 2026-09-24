import { attachEvidence, scenarioStartMs, step } from "@/sim";
import type { EvidenceSet, SimState } from "@/sim/types";
import type { MiniTerminalScenario } from "@/content/mini-terminals";

/**
 * The practice evidence behind a lesson's `<MiniTerminal>` (docs/plan/13-learning-center.md): a
 * drive generated from one of the stories in src/content/practice/stories.ts and committed as
 * `<id>.evidence.json` by `pnpm evidence:build`.
 *
 * Each file is fetched with a dynamic `import()`, so it is its own small chunk, loaded only by a
 * lesson whose practice machine names it (00 §4 row 12). One promise per id, shared by every
 * terminal that asks.
 */

const PRACTICE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const pending = new Map<string, Promise<EvidenceSet>>();

/** The practice evidence with this id. Rejects when no story by that name has been built. */
export function practiceEvidence(id: string): Promise<EvidenceSet> {
  let promise = pending.get(id);
  if (!promise) {
    promise = load(id);
    pending.set(id, promise);
  }
  return promise;
}

async function load(id: string): Promise<EvidenceSet> {
  if (!PRACTICE_ID.test(id)) throw new Error(`"${id}" is not a practice story's id.`);
  const loaded: unknown = await import(`../../../content/practice/${id}.evidence.json`);
  // A JSON module is the value itself under `default`, whichever way the bundler wrapped it.
  const set =
    typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : loaded;
  return set as EvidenceSet;
}

/**
 * What the practice machine starts with on top of its scenario, on start and again on Reset
 * machine: the evidence attached under /dev/evidence with every write-blocker on, then the
 * machine's `prepare` commands, run through the engine exactly as if they had been typed.
 *
 * Throws when a `prepare` command doesn't succeed, which is an authoring mistake the lesson tests
 * catch, never something a learner can cause.
 */
export function practiceSetup(
  mini: MiniTerminalScenario,
  evidence: EvidenceSet,
): (sim: SimState) => SimState {
  const now = scenarioStartMs(mini.scenario);
  return (sim) => {
    let next = attachEvidence(sim, evidence, { now });
    for (const line of mini.prepare ?? []) {
      const result = step(next, { type: "exec", argv: line.split(" ") }, { now: () => now });
      if (result.exitCode !== 0) {
        throw new Error(`The practice machine "${mini.id}" couldn't prepare: \`${line}\` failed.`);
      }
      next = result.state;
    }
    return next;
  };
}
