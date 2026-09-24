import type { Case, ObjectiveCheck as CaseCheck } from "@/content/cases/schema";
import { EvidencePatternError, resolveAcceptedEvidence } from "@/sim";
import type { EvidenceSet } from "@/sim/types";
import type {
  CaseBeat,
  CaseLine,
  CaseObjective,
  CaseReportQuestion,
  ObjectiveCheck,
  RunnableCase,
} from "../run/case-definition";
import { getCase } from "./catalog";
import { caseScenario } from "./scenario";
import { buildCase, type BuiltCase } from "./source";

/**
 * A case file, as the case runner plays it in the browser (`RunnableCase`, run/case-definition.ts).
 *
 * The runner is deliberately smaller than the case schema, and the schema's module (full Zod) can't
 * reach a browser page, so this is where the two meet, on the server, when the case page is built:
 *
 * - The workstation is the one headless play uses (`caseScenario`), so the browser's terminal and
 *   `pnpm case:play` start from the same machine, clock and case folder.
 * - Evidence patterns (`pinned` checks) are resolved into the refs they match now, against the
 *   evidence the story builds, which the staleness test holds equal to the JSON the browser loads.
 * - The cold open (`on: start` beats) is the briefing's opening; every other beat plays during the
 *   case.
 *
 * Something the browser runner can't play yet (an `answer` check, a beat on a report question)
 * throws here, naming the case, rather than quietly leaving a step that can never tick.
 */
export function toRunnableCase(built: BuiltCase): RunnableCase {
  const entry = built.case;
  const { scenario, seed } = caseScenario(entry, built.evidence);
  const cannot = (what: string) =>
    new Error(`${entry.id}: the browser's case runner can't play ${what} yet.`);

  const opening: CaseLine[] = [];
  const story: CaseBeat[] = [];
  for (const beat of entry.beats) {
    const line = { speaker: beat.speaker, text: beat.text };
    if (beat.on === "start") opening.push(line);
    else if (beat.on === "complete") story.push({ ...line, on: "complete" });
    else if ("objective" in beat.on) story.push({ ...line, on: { objective: beat.on.objective } });
    else throw cannot(`a beat on report question "${beat.on.question}"`);
  }

  const objectives = entry.objectives.map((objective): CaseObjective => {
    const hints = entry.hints[objective.id];
    return {
      id: objective.id,
      description: objective.description,
      why: objective.why,
      success: objective.success,
      ...(objective.name !== undefined && { name: objective.name }),
      ...(objective.optional === true && { optional: true }),
      ...(objective.hidden === true && { hidden: true }),
      hints: hints ? [hints[0], hints[1], hints[2]] : [],
      check: toCheck(objective.check, built.evidence, cannot),
    };
  });

  return {
    id: entry.id,
    slug: entry.id,
    title: entry.title,
    hook: entry.hook,
    estimatedMinutes: entry.estimatedMinutes,
    client: {
      org: entry.client.org,
      signedBy: entry.client.signedBy,
      scope: entry.briefing.authorization,
    },
    briefing: { opening, situation: `${entry.briefing.scenario} ${entry.briefing.role}` },
    objectives,
    story,
    defensiveTakeaway: entry.debrief.defensiveTakeaway,
    scenario,
    seed,
    report: {
      questions: entry.report.questions.map((question): CaseReportQuestion => ({
        id: question.id,
        ask: question.ask,
        type: question.type,
        ...(question.choices && { choices: question.choices }),
        answer: question.answer,
        ...("answerAt" in question && { answerAt: question.answerAt }),
        ...(question.toleranceSeconds !== undefined && {
          toleranceSeconds: question.toleranceSeconds,
        }),
        acceptedRefs: built.acceptedRefs.get(question.id) ?? [],
        explain: question.explain,
      })),
    },
    debrief: {
      summary: entry.debrief.summary,
      whatYouLearned: entry.debrief.whatYouLearned,
      ethicsNote: entry.debrief.ethicsNote,
      nextTease: entry.debrief.nextTease,
    },
  };
}

function toCheck(
  check: CaseCheck,
  evidence: EvidenceSet,
  cannot: (what: string) => Error,
): ObjectiveCheck {
  switch (check.kind) {
    case "all":
    case "any":
      return { kind: check.kind, of: check.of.map((inner) => toCheck(inner, evidence, cannot)) };
    case "commandRun":
      return {
        kind: "commandRun",
        pattern: check.pattern,
        ...(check.anyExitCode === true && { anyExitCode: true }),
      };
    case "pinned":
      return { kind: "pinned", refs: resolved(evidence, check.evidence) };
    case "reported":
      return { kind: "reported", question: check.question };
    case "answer":
      throw cannot("an objective checked by a typed answer");
  }
}

/** A pattern's refs, or none. The build has already refused a pattern that doesn't resolve. */
function resolved(evidence: EvidenceSet, pattern: string): string[] {
  try {
    return resolveAcceptedEvidence(evidence, pattern);
  } catch (error) {
    if (!(error instanceof EvidencePatternError)) throw error;
    return [];
  }
}

const runnable = new Map<string, RunnableCase>();

/**
 * The case at `/cases/<id>`, ready for the runner, or undefined for an id that isn't a case file.
 * Built once per id in production; in development the catalog re-reads the file, so an edited case
 * shows up on reload.
 */
export function getRunnableCase(id: string): RunnableCase | undefined {
  const cached = runnable.get(id);
  if (cached) return cached;
  const entry: Case | undefined = getCase(id);
  if (!entry) return undefined;
  const caseDef = toRunnableCase(buildCase(entry));
  if (process.env.NODE_ENV === "production") runnable.set(id, caseDef);
  return caseDef;
}
