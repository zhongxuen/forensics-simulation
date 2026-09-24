import { z } from "zod";
import {
  capTranscript,
  HINT_TRANSCRIPT_LIMITS,
  REVIEW_TRANSCRIPT_LIMITS,
  trimLine,
  trimOutput,
  type MentorTranscript,
} from "./transcript";
import type { ExplainSubject, HintTier } from "./protocol";

/**
 * The mentor requests, as they arrive from the browser (docs/plan/14-mentor.md). Vendored from
 * `../hacker-simulation/src/features/mentor/schema.ts` and adapted to cases (VENDORED.md):
 * `caseId` for `missionId`, an explain subject that covers the three investigator views, and a
 * review request that carries the shape of the chain of custody.
 *
 * Every request is untrusted — the schemas validate the shape and re-apply the transcript caps here
 * (a forged body only ever changes the sender's own answer), so the model never sees more than the
 * caps allow no matter what was posted.
 *
 * **Authored content is never in a request**: the server loads hints, objectives and glossary
 * definitions from the content itself, by id. A request only ever says which one is wanted. That is
 * why every schema below is `strictObject`: a body that smuggles in its own `hint` field is a 400,
 * not a field that is quietly ignored.
 */

/** Ids are content ids (lowercase words and single hyphens); a generous max keeps abuse bounded. */
const idField = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and single hyphens.");

/**
 * A case id, which may carry the fixture prefix (`_fixture`). A fixture is never offered to a
 * player, but the tests play one, and the route answers about whatever the catalog holds.
 */
const caseIdField = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^_?[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and single hyphens.");

/** A single command and its output, before the shared caps trim them. */
// Generous pre-cap bounds: honest tool output can be long, and `capTranscript` (the transform
// below) trims to the real caps. The route's 16 KB body-size cap is the first line of defence.
const transcriptEntrySchema = z.strictObject({
  input: z.string().max(8_000),
  output: z.string().max(100_000),
});

/**
 * A transcript, capped defensively here as well as in the browser. Bounded to a sane count before
 * capping so a forged multi-megabyte array can't cost us a large parse; the body-size cap in the
 * route is the first line of defence.
 */
const transcriptSchema = (limits = HINT_TRANSCRIPT_LIMITS) =>
  z
    .array(transcriptEntrySchema)
    .max(200)
    .default([])
    .transform((entries): MentorTranscript => capTranscript(entries, limits));

// ---------------------------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------------------------

export const MentorHintRequestSchema = z.strictObject({
  caseId: caseIdField,
  objectiveId: idField,
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  transcript: transcriptSchema(),
});

export type MentorHintRequest = z.output<typeof MentorHintRequestSchema>;

export interface MentorRequestParse {
  readonly ok: boolean;
  readonly request?: MentorHintRequest;
}

/** Validates and caps a parsed request body. On any problem `ok` is false and the client falls back. */
export function parseMentorHintRequest(data: unknown): MentorRequestParse {
  const result = MentorHintRequestSchema.safeParse(data);
  return result.success ? { ok: true, request: result.data } : { ok: false };
}

/** Narrows a validated tier to the shared `HintTier` type. */
export function asHintTier(tier: 1 | 2 | 3): HintTier {
  return tier;
}

// ---------------------------------------------------------------------------------------------
// "Explain this"
// ---------------------------------------------------------------------------------------------

/** The views a row can be pointed at in, beside the terminal (docs/plan/14 §Spec). */
export const EXPLAIN_ROW_VIEWS = ["evidence", "timeline", "board"] as const;

/**
 * What the player pointed at. Text from a screen is capped like a transcript entry: one line of the
 * command or the row's heading, and at most the transcript's output caps of what it showed.
 */
const explainSubjectSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("output"),
    command: z
      .string()
      .max(8_000)
      .transform((command) => trimLine(command)),
    text: z
      .string()
      .max(100_000)
      .transform((text) => trimOutput(text)),
    scope: z.enum(["line", "output"]),
    error: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal("row"),
    view: z.enum(EXPLAIN_ROW_VIEWS),
    text: z
      .string()
      .max(100_000)
      .transform((text) => trimOutput(text)),
    title: z.optional(
      z
        .string()
        .max(8_000)
        .transform((title) => trimLine(title)),
    ),
  }),
  z.strictObject({ kind: z.literal("term"), termId: idField }),
]);

export const MentorExplainRequestSchema = z.strictObject({
  caseId: caseIdField,
  /** The objective the player is on, for context. Optional: the case may be finished. */
  objectiveId: idField.optional(),
  subject: explainSubjectSchema,
  transcript: transcriptSchema(),
});

export type MentorExplainRequest = z.output<typeof MentorExplainRequestSchema> & {
  readonly subject: ExplainSubject;
};

export function parseMentorExplainRequest(
  data: unknown,
): { readonly ok: true; readonly request: MentorExplainRequest } | { readonly ok: false } {
  const result = MentorExplainRequestSchema.safeParse(data);
  return result.success ? { ok: true, request: result.data } : { ok: false };
}

// ---------------------------------------------------------------------------------------------
// The debrief review
// ---------------------------------------------------------------------------------------------

/**
 * The chain of custody as the review sees it: the kind of each entry, in order, and the two facts
 * about that order. `src/features/cases/custody` builds the real record; only its shape travels.
 * Anything that isn't one of the record's own kinds is dropped when the prompt is built
 * (`knownCustodyKinds`), so a forged body can't put words in the prompt.
 */
const custodySchema = z
  .strictObject({
    order: z.array(z.string().max(40)).max(400).default([]),
    hashedFirst: z.boolean().default(false),
    readAroundBlocker: z.boolean().default(false),
  })
  .default({ order: [], hashedFirst: false, readAroundBlocker: false });

/**
 * The run, as facts the server can check against the case: which objectives were ticked (by id),
 * how many hint tiers were opened for each, how the chain of custody ran, how the report landed,
 * the time taken, and Reset machine presses. The objectives' words come from the case content,
 * never from here, and the report's answers never travel in either direction.
 */
export const MentorReviewRequestSchema = z.strictObject({
  caseId: caseIdField,
  completed: z.array(idField).max(40),
  hintsOpened: z
    .record(idField, z.number().int().min(0).max(3))
    .refine((record) => Object.keys(record).length <= 40, "Too many objectives."),
  custody: custodySchema,
  pinCount: z.number().int().min(0).max(1_000).default(0),
  /** "n of m findings supported". Counts only: never which finding, and never an answer. */
  findings: z
    .nullable(
      z.strictObject({
        supported: z.number().int().min(0).max(100),
        total: z.number().int().min(0).max(100),
      }),
    )
    .default(null),
  minutes: z
    .number()
    .min(0)
    .max(24 * 60)
    .nullable(),
  resets: z.number().int().min(0).max(1_000),
  commandCount: z.number().int().min(0).max(10_000),
  transcript: transcriptSchema(REVIEW_TRANSCRIPT_LIMITS),
});

export type MentorReviewRequest = z.output<typeof MentorReviewRequestSchema>;

export function parseMentorReviewRequest(
  data: unknown,
): { readonly ok: true; readonly request: MentorReviewRequest } | { readonly ok: false } {
  const result = MentorReviewRequestSchema.safeParse(data);
  if (!result.success) return { ok: false };
  // More supported than there are findings is a forged body, not a run.
  const { findings } = result.data;
  if (findings && findings.supported > findings.total) return { ok: false };
  return { ok: true, request: result.data };
}
