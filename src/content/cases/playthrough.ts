import { z } from "zod";
import { ContentIdSchema } from "../schemas/ids";

/**
 * A playthrough: a case played from a script instead of by a person
 * (docs/plan/03-case-format-and-generator.md §Tests, group 5 — solvability).
 *
 * One YAML file per case in `src/content/cases/playthroughs`, named after the case:
 * `case-01.yaml`. It is the proof that the case can actually be finished with the tools the game
 * has: `pnpm case:play <id>` runs it and prints the transcript, `pnpm case:validate` and
 * `tests/content/case-solvability.test.ts` run every one of them and fail if a case stops
 * completing. Edit a story action and the evidence moves; if that breaks the way through, this is
 * what says so, before a player ever meets it.
 *
 * Follows `../hacker-simulation/src/content/schemas/playthrough.ts` step for step, with the two
 * steps a case has that a mission doesn't: putting evidence on the board (`pin`) and answering a
 * report question (`report`).
 */

const text = (what: string) =>
  z
    .string({
      error: (issue) => (issue.input === undefined ? `Missing: add ${what}.` : "Should be text."),
    })
    .trim()
    .min(1, `Can't be empty: add ${what}.`);

/** Objective ids a step is expected to tick. Checked when given. */
const ticks = z.array(ContentIdSchema).optional();

const RunStepSchema = z.strictObject({
  /** A command line, typed exactly as a player would type it. */
  run: text("the command line to type"),
  ticks,
});

/**
 * Put a piece of evidence on the case board without going through a tool. Written as an evidence
 * pattern (`disk:qf-lt-03:mft/*docket*`), the same shape a report question's `acceptedEvidence`
 * uses, so it keeps working when the story moves and the record numbers change. A pin a *player*
 * would make from the terminal is a `run: pin …` step; this one stands in for the views that pin
 * from a click (files 09 and 10).
 */
const PinStepSchema = z.strictObject({
  pin: text("the evidence to pin, as a pattern"),
  ticks,
});

/** The three verdicts a report answer can get (docs/plan/00-overview.md §4, row 7). */
export const REPORT_VERDICTS = ["supported", "needs-evidence", "not-yet"] as const;
export type ReportVerdict = (typeof REPORT_VERDICTS)[number];

const ReportStepSchema = z.strictObject({
  /** The report question's id. */
  report: ContentIdSchema,
  answer: text("the answer to write on the report"),
  /**
   * The pinned evidence the answer cites, as evidence patterns (the report's "Supporting evidence"
   * picker). An answer only counts as supported when something it cites is on the board and proves
   * it, so leave this out to see an answer come back as needs evidence.
   */
  cite: z.array(text("an evidence pattern to cite")).optional(),
  /** What the answer should come back as. Defaults to `supported`. */
  verdict: z.enum(REPORT_VERDICTS).default("supported"),
  ticks,
});

/** Answer an objective that asks a question directly (an `answer` check), rather than the report. */
const AnswerStepSchema = z.strictObject({
  objective: ContentIdSchema,
  answer: text("the answer"),
  /** Whether it should be accepted. Defaults to true. */
  accepted: z.boolean().default(true),
  ticks,
});

const ResetStepSchema = z.strictObject({
  /** Press Reset machine. */
  reset: z.literal(true),
  ticks,
});

export const PlaythroughStepSchema = z.union(
  [RunStepSchema, PinStepSchema, ReportStepSchema, AnswerStepSchema, ResetStepSchema],
  {
    error:
      "Each step is one of: run: <command>, pin: <evidence pattern>, report: <question id> with answer: <text>, answer: <text> with objective: <id>, or reset: true.",
  },
);

export const PlaythroughSchema = z.strictObject({
  /** The case's id. Must match the file name. */
  case: z
    .string({ error: "Missing: add the case this plays, like `case: case-01`." })
    .regex(/^_?[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use the case's id, like `case-01`."),
  /** A line on what this playthrough shows: "The shortest way through, hashes and all." */
  description: text("a line on what this playthrough shows").optional(),
  steps: z.array(PlaythroughStepSchema).min(1, "Add at least one step."),
  expect: z
    .strictObject({
      /** Every main objective ticked by the end. Defaults to true. */
      complete: z.boolean().default(true),
      /** Objectives that must be ticked by the end, bonuses and secrets included. */
      objectives: z.array(ContentIdSchema).default([]),
      /** Every report question ends up supported: answered, and pointing at evidence. */
      supported: z.boolean().default(true),
    })
    .default({ complete: true, objectives: [], supported: true }),
});

export type PlaythroughStep = z.output<typeof PlaythroughStepSchema>;
export type Playthrough = z.output<typeof PlaythroughSchema>;

export type PlaythroughParseResult =
  | { readonly success: true; readonly playthrough: Playthrough }
  | { readonly success: false; readonly problems: readonly string[] };

/** Validates playthrough data (already read from YAML), listing every problem as `path: message`. */
export function parsePlaythrough(data: unknown): PlaythroughParseResult {
  const result = PlaythroughSchema.safeParse(data);
  if (result.success) return { success: true, playthrough: result.data };
  return {
    success: false,
    problems: result.error.issues.map((issue) => {
      const path = issue.path.map((part) => (typeof part === "number" ? `[${part + 1}]` : part));
      const where = path.join(".").replace(/\.\[/g, "[");
      return where === "" ? issue.message : `${where}: ${issue.message}`;
    }),
  };
}
