import { REVIEW_LIMITS } from "../review";
import {
  AUDIENCE,
  DATA_RULE,
  FORENSICS_RULE,
  PERSONA,
  SAFETY,
  SCREEN_OPEN,
  VOICE,
} from "./noor.v1";

/**
 * Version 1 of the debrief review prompt (docs/plan/14-mentor.md §Spec: "Looking back with Noor"
 * on the debrief: structured JSON, validated, leading with what the player did well, and mentioning
 * the custody log's order (did they hash first?)").
 *
 * Vendored from the sibling's `review.v1` (VENDORED.md), with the custody part added — the one
 * thing this game teaches that a mission never had.
 *
 * `buildReviewPrompt` gives the model only what the player has already seen: the objectives they
 * ticked, the bonuses and secrets they found, the case's learning goals, the shape of their chain
 * of custody, and the lesson ids it may suggest. It is built from a `MentorCase` (case-view.ts),
 * so a hint's text, an objective's check or success line, a report answer, an accepted ref, an
 * unfound secret and the story's ground truth are all structurally out of reach.
 *
 * The answer is JSON, constrained by REVIEW_JSON_SCHEMA (structured outputs) and checked again on
 * the server before anything reaches the browser.
 */
export const REVIEW_PROMPT_VERSION = "review.v1";

/**
 * The JSON schema the review must follow. Structured outputs need every object closed
 * (`additionalProperties: false`) and every property required; lengths are enforced on the server.
 */
export const REVIEW_JSON_SCHEMA: Readonly<Record<string, unknown>> = {
  type: "object",
  properties: {
    wellDone: { type: "string" },
    approach: { type: "string" },
    custody: { type: "string" },
    efficientSteps: { type: "array", items: { type: "string" } },
    detours: { type: "array", items: { type: "string" } },
    tryNext: {
      type: "array",
      items: {
        type: "object",
        properties: { lessonId: { type: "string" }, why: { type: "string" } },
        required: ["lessonId", "why"],
        additionalProperties: false,
      },
    },
    signOff: { type: "string" },
  },
  required: ["wellDone", "approach", "custody", "efficientSteps", "detours", "tryNext", "signOff"],
  additionalProperties: false,
};

export interface ReviewPromptInput {
  readonly caseTitle: string;
  readonly learningGoals: readonly string[];
  /** Main objectives, in order, with whether each was done and hint tiers opened. */
  readonly mainObjectives: readonly {
    readonly description: string;
    readonly done: boolean;
    readonly hintsOpened: number;
  }[];
  /** Bonus objectives and secrets the player found (never ones they haven't). */
  readonly extrasFound: readonly { readonly name: string; readonly description: string }[];
  /**
   * The chain of custody as **order alone**: each entry's kind, oldest first, and whether a hash
   * came before anything opened the evidence. No digest, path, record number or ref: those are
   * evidence, and this prompt never holds evidence.
   */
  readonly custody: {
    readonly order: readonly string[];
    readonly hashedFirst: boolean;
    readonly readAroundBlocker: boolean;
  };
  readonly pinCount: number;
  /** "n of m findings supported", or null for a case with no report questions. */
  readonly findings: { readonly supported: number; readonly total: number } | null;
  readonly minutes: number | null;
  readonly resets: number;
  readonly commandCount: number;
  /** Lesson ids Noor may suggest, gentlest first. */
  readonly lessonIds: readonly string[];
}

function objectiveLines(input: ReviewPromptInput): string {
  return input.mainObjectives
    .map(
      (objective, index) =>
        `  ${index + 1}. ${objective.description} (${objective.done ? "done" : "not done"}; hints opened: ${objective.hintsOpened})`,
    )
    .join("\n");
}

/** The custody record as the prompt states it: the order, then the one fact that matters. */
function custodySection(custody: ReviewPromptInput["custody"]): string {
  const order =
    custody.order.length === 0
      ? "  (empty: nothing they did has touched the evidence yet)"
      : `  ${custody.order.join(" → ")}`;
  return `THE ORDER OF THEIR CHAIN OF CUSTODY
This is the record of what they did to the evidence, in order, with only the kind of each step (no file names, times or hashes — you don't get those).
${order}
  A hash was taken before anything opened the evidence: ${custody.hashedFirst ? "yes" : "no"}.
  An original was read with its write-blocker off at some point: ${custody.readAroundBlocker ? "yes" : "no"}.`;
}

export function buildReviewSystemPrompt(input: ReviewPromptInput): string {
  const extras =
    input.extrasFound.length === 0
      ? "  (none)"
      : input.extrasFound.map((extra) => `  - ${extra.name}: ${extra.description}`).join("\n");
  const minutes =
    input.minutes === null ? "unknown" : `about ${Math.max(1, Math.round(input.minutes))}`;
  const findings =
    input.findings === null
      ? "  This case had no report questions."
      : `  Findings supported by evidence they pinned: ${input.findings.supported} of ${input.findings.total}.`;

  return `${PERSONA}

${AUDIENCE}

YOUR ONE JOB
The player has finished the case "${input.caseTitle}". Look back at their run with them and write a short, warm review. This is formative feedback from a mentor, never a grade, a score, or a list of weaknesses.

WHAT THE CASE TEACHES
${input.learningGoals.map((goal) => `  - ${goal}`).join("\n")}

THE MAIN OBJECTIVES
${objectiveLines(input)}

BONUS OBJECTIVES AND SECRETS THEY FOUND
${extras}

${custodySection(input.custody)}

THE RUN
  Minutes: ${minutes}. Commands run: ${input.commandCount}. Times they reset the workstation: ${input.resets}. Pieces of evidence on the case board: ${input.pinCount}.
${findings}
  Their commands and what the computer showed are in the ${SCREEN_OPEN} block (the most recent ones, with only the start of each output).

LESSONS YOU MAY SUGGEST (use these ids exactly, and no others)
${input.lessonIds.map((id) => `  - ${id}`).join("\n")}

HOW TO WRITE IT
- wellDone: one or two sentences on something specific they did well, taken from their run. Name the actual thing ("You checked the drive's hash against the handover form before you opened anything"), never a generic "great job". This always comes first.
- approach: one or two sentences describing how they went about the case, in order.
- custody: one or two sentences on the order of their chain of custody above. If the hash came first, say why that order is what makes everything after it hold up. If it didn't, say what hashing first would have given them next time — as something worth knowing, never as a telling-off, and never as though the case is ruined. If an original was read with the write-blocker off, you may name that as the thing that moves a drive's times and its hash with them. Do not invent a file, a time or a hash: you only have the order.
- efficientSteps: up to ${REVIEW_LIMITS.efficientSteps} short sentences naming steps that went smoothly.
- detours: up to ${REVIEW_LIMITS.detours} short sentences on scenic routes: steps that took longer than they needed to, framed as something worth knowing for next time ("\`lsfs --deleted\` would have shown the removed records in one go"), never as a mistake. An empty list is fine. A command that printed an error is normal practice, not a detour worth mentioning, unless there's a genuinely useful tip in it.
- tryNext: one to ${REVIEW_LIMITS.tryNext} lessons from the list above, each with one sentence on why it's a good next step after this run. Frame them as "try next", never as fixing a weakness.
- signOff: one short, encouraging closing line in Noor's voice.
- Hints are free and using them is smart. Never treat hints opened, errors, resets or time as a bad thing, and never praise someone for not using hints.
- Never mention speed as an achievement, and never compare them to anyone.
- A finding that isn't supported is not a wrong answer: it means the evidence for it isn't on the board yet. Say it that way, and never say which evidence would support it.

${VOICE}

${SAFETY}

${FORENSICS_RULE}
The case is over, and that changes nothing: a player can go straight back and change their report from this screen, so an answer given here would still be an answer given.

${DATA_RULE}

Answer with only the JSON object.`;
}

export function buildReviewUserMessage(screen: string): string {
  return `Here is the player's run in the terminal. Read it, then write Noor's review.

${screen}`;
}
