// zod/mini, not zod: this runs in the browser on the case pages and /privacy, and full Zod adds
// about 90 KB (gzipped) that can't be tree-shaken (see src/lib/settings/schema.ts).
import * as z from "zod/mini";

/**
 * Saved case runs (docs/plan/05-workspace-ui.md §Saving case runs, and 00 §4 row 9): what the
 * player did in a case, kept in this browser so a 30-minute case survives a closed tab.
 *
 * A save holds the command log, never the engine's state: loading replays the log through the
 * engine, so a save can't hold a machine state the engine would never make, and an engine change
 * can't strand an old save. Everything else is what the player wrote or earned: pins, notes, the
 * report draft, ticks, hints shown and the story lines played.
 *
 * The value under the key is `{ v: 1, runs: Record<caseId, CaseRunSave> }`. `migrate` turns
 * anything (an older version, a hand-edited value, garbage) into that shape and never throws.
 */

/** The version this code writes. Bump it, and teach `migrate` the old shape, when a save changes. */
export const CASE_STORE_VERSION = 1;

/** Limits, so a save (or an imported file) can't grow without bound. */
export const MAX_LOG_ENTRIES = 10_000;
export const MAX_LINE_LENGTH = 4096;
export const MAX_PINS = 500;
export const MAX_NOTES_LENGTH = 20_000;
export const MAX_DRAFT_LENGTH = 4000;
export const MAX_RUNS = 100;
export const MAX_PIN_NOTE_LENGTH = 500;
export const MAX_MARKS = 2000;
/** Hints come in three tiers (docs/plan/99-reference.md, authoring checklist). */
export const HINT_TIERS = 3;

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
/**
 * An artefact ref (`disk:<image>:mft/1234`, `log:security/57`, …). Only the outline is checked
 * here: the full check lives in the engine (src/sim/evidence/refs.ts), which this module doesn't
 * load. A pin that names nothing in the case's evidence is ignored where pins are shown.
 */
const REF = /^(disk|mem|log):[\w.:/*-]{1,200}$/;

const id = () => z.string().check(z.regex(ID));
const count = () => z.int().check(z.nonnegative());

/**
 * One entry in the workstation's log: a line the player typed, Reset machine, or an image opened
 * in the Evidence Browser (its workstation path). Opening an original with its write-blocker off
 * changes it, so a save has to replay those opens too, in order. Adding the `browse` entry kept
 * the shape backward compatible, so it didn't need a new version.
 */
export const LogEntrySchema = z.union([
  z.strictObject({ line: z.string().check(z.maxLength(MAX_LINE_LENGTH)) }),
  z.strictObject({ reset: z.literal(true) }),
  z.strictObject({ browse: z.string().check(z.minLength(1), z.maxLength(MAX_LINE_LENGTH)) }),
]);

export type LogEntry = z.output<typeof LogEntrySchema>;

const ref = () => z.string().check(z.regex(REF));

/**
 * Something the chain of custody (src/features/cases/custody) records that the engine's events
 * don't: a pin made from a view rather than the terminal, and each time the report was submitted
 * (with how many findings were supported then). `after` is how many engine events the run had at
 * that moment; replaying the log rebuilds the same events, so the mark lands in the same place.
 */
export const RunMarkSchema = z.union([
  z.strictObject({ after: count(), kind: z.literal("pinned"), ref: ref() }),
  z.strictObject({
    after: count(),
    kind: z.literal("submitted"),
    supported: count(),
    total: count(),
  }),
]);

export type RunMark = z.output<typeof RunMarkSchema>;

/** The phases a saved run can be in. A run still on its briefing has nothing worth saving. */
export const SavedPhaseSchema = z.enum(["workspace", "report", "debrief"]);

export const CaseRunSaveSchema = z.object({
  phase: SavedPhaseSchema,
  log: z.array(LogEntrySchema).check(z.maxLength(MAX_LOG_ENTRIES)),
  pins: z.array(z.string().check(z.regex(REF))).check(z.maxLength(MAX_PINS)),
  notes: z.string().check(z.maxLength(MAX_NOTES_LENGTH)),
  reportDraft: z.record(id(), z.string().check(z.maxLength(MAX_DRAFT_LENGTH))),
  completed: z.array(id()),
  hintsShown: z.record(id(), z.int().check(z.gte(0), z.lte(HINT_TIERS))),
  beatsPlayed: z.array(count()),
  /**
   * The pins each report answer cites, by question id (file 10). The next three fields arrived
   * after version 1 shipped, each defaulting to empty, so an older save still reads as it was.
   */
  citations: z._default(z.record(id(), z.array(ref()).check(z.maxLength(MAX_PINS))), () => ({})),
  /** The player's note on each pin, by ref. */
  pinNotes: z._default(
    z.record(ref(), z.string().check(z.maxLength(MAX_PIN_NOTE_LENGTH))),
    () => ({}),
  ),
  /** View pins and report submissions, for the chain of custody. */
  marks: z._default(z.array(RunMarkSchema).check(z.maxLength(MAX_MARKS)), () => []),
  /** When it was saved (milliseconds since the Unix epoch). Shown, never compared. */
  savedAt: count(),
});

export type CaseRunSave = z.output<typeof CaseRunSaveSchema>;

export interface CaseStore {
  readonly v: typeof CASE_STORE_VERSION;
  readonly runs: Readonly<Record<string, CaseRunSave>>;
}

export const EMPTY_CASE_STORE: CaseStore = Object.freeze({ v: 1, runs: Object.freeze({}) });

/**
 * Version 0, the shape the plan sketched before file 05: typed lines under `commands`, ticks under
 * `ticked`, no report draft, hints or story. Nothing shipped with it, but the path is kept (and
 * tested) so the next version change has a worked example to copy.
 */
const V0RunSchema = z.object({
  commands: z
    .array(z.string().check(z.maxLength(MAX_LINE_LENGTH)))
    .check(z.maxLength(MAX_LOG_ENTRIES)),
  pins: z.optional(z.array(z.string().check(z.regex(REF))).check(z.maxLength(MAX_PINS))),
  notes: z.optional(z.string().check(z.maxLength(MAX_NOTES_LENGTH))),
  ticked: z.optional(z.array(id())),
});

type V0Run = z.output<typeof V0RunSchema>;

const fromV0 = (run: V0Run): CaseRunSave => ({
  phase: "workspace",
  log: run.commands.map((line) => ({ line })),
  pins: run.pins ?? [],
  notes: run.notes ?? "",
  reportDraft: {},
  completed: run.ticked ?? [],
  hintsShown: {},
  beatsPlayed: [],
  citations: {},
  pinNotes: {},
  marks: [],
  savedAt: 0,
});

function readV0(value: unknown): CaseRunSave | undefined {
  const parsed = V0RunSchema.safeParse(value);
  return parsed.success ? fromV0(parsed.data) : undefined;
}

function readV1(value: unknown): CaseRunSave | undefined {
  const parsed = CaseRunSaveSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export interface MigrateReport {
  readonly store: CaseStore;
  /** Case ids whose run was there but couldn't be read, so was left out. */
  readonly rejected: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `migrate`, with a list of the runs it had to leave out: the import on /privacy refuses a file
 * with any, where loading from storage quietly keeps the rest.
 */
export function migrateWithReport(raw: unknown): MigrateReport {
  if (!isRecord(raw) || !isRecord(raw.runs)) return { store: EMPTY_CASE_STORE, rejected: [] };
  // A value written by a newer version can't be read safely: start fresh rather than guess.
  const version = raw.v ?? 0;
  if (version !== 0 && version !== CASE_STORE_VERSION) {
    return { store: EMPTY_CASE_STORE, rejected: Object.keys(raw.runs) };
  }

  const runs: Record<string, CaseRunSave> = {};
  const rejected: string[] = [];
  for (const [caseId, value] of Object.entries(raw.runs)) {
    if (!ID.test(caseId) || Object.keys(runs).length >= MAX_RUNS) {
      rejected.push(caseId);
      continue;
    }
    const run = version === 0 ? readV0(value) : readV1(value);
    if (run) runs[caseId] = run;
    else rejected.push(caseId);
  }
  return { store: { v: CASE_STORE_VERSION, runs }, rejected };
}

/**
 * Any value to the current shape: a v1 value as it stands, a v0 value upgraded, and anything
 * else (garbage, a newer version) as an empty store. A run that doesn't validate is left out on
 * its own, so one bad run never costs the others. Never throws.
 */
export function migrate(raw: unknown): CaseStore {
  return migrateWithReport(raw).store;
}
