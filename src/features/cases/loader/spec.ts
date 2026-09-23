import type { Case } from "@/content/cases/schema";
import type { CaseSpec } from "@/sim";

/**
 * The bridge between the two halves of a case (docs/plan/03-case-format-and-generator.md).
 *
 * `src/content` may not import the engine, and `src/sim` may not import content, so the authoring
 * schema and the generator's input are written separately. This one function joins them, and the
 * compiler checks they still agree: rename a field on either side and this stops building.
 *
 * Everything else in a case — the briefing, the objectives, the report, the debrief — is for the
 * player, and the generator neither sees nor needs it.
 */
export function toCaseSpec(entry: Case): CaseSpec {
  return {
    id: entry.id,
    seed: entry.seed,
    machines: entry.machines,
    story: entry.story,
    ...(entry.noise === undefined ? {} : { noise: entry.noise }),
    evidence: entry.evidence,
  };
}
