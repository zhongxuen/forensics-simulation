import {
  HINT_TIERS,
  MAX_DRAFT_LENGTH,
  MAX_LINE_LENGTH,
  MAX_LOG_ENTRIES,
  MAX_MARKS,
  MAX_NOTES_LENGTH,
  MAX_PIN_NOTE_LENGTH,
  MAX_PINS,
  type CaseRunSave,
  type LogEntry,
  type RunMark,
} from "@/lib/case-storage";
import type { CastId } from "@/content/cast";
import type { SimEvent, SimState } from "@/sim/types";
import { gradeReport, reportAnswers, supportedCount } from "../grading";
import type { CaseObjective, RunnableCase } from "./case-definition";
import { evaluateObjectives, isCaseComplete, type ObjectiveEvaluator } from "./evaluate";

/**
 * One case run, as pure data (docs/plan/05-workspace-ui.md §Case runner), modelled on Hacker
 * Simulation's `missionRunReducer`: the phase, the engine's latest state, every event since the
 * run started, the terminal's command log, the ticks earned, the story lines played, the hints
 * shown, and what the player wrote: pins and their notes, notes, the report draft and what each
 * answer cites. Everything that changes it
 * is `caseRunReducer`, so the React store (useCaseRun), headless play and the tests all run the
 * same code.
 *
 * Unlike a mission run, a case run is saved in this browser (src/lib/case-storage): `toSave`
 * picks out what's kept, and the `restore` action brings it back. The engine's state is never
 * saved: the command log is, and replaying it rebuilds the rest (run/replay.ts).
 */

export type CasePhase = "briefing" | "workspace" | "report" | "debrief";

/** A line in the case's story feed. */
export interface StoryEntry {
  readonly id: number;
  readonly speaker: CastId;
  readonly text: string;
}

export interface CaseRunState {
  readonly phase: CasePhase;
  /** Goes up with every restart, so the terminal starts a fresh session. */
  readonly attempt: number;
  /** The engine's latest state: null until the run starts. Never saved. */
  readonly sim: SimState | null;
  /** Every event since the run started, across machine resets. Never saved: replay rebuilds it. */
  readonly events: readonly SimEvent[];
  /**
   * Every line typed, every Reset machine press and every image opened in the Evidence Browser,
   * oldest first: what a save replays.
   */
  readonly log: readonly LogEntry[];
  /** Objectives ticked, in the order they were ticked. Once earned, a tick stays. */
  readonly completed: readonly string[];
  /** Indexes into `caseDef.story` of the lines already played. Each plays once per run. */
  readonly beatsPlayed: readonly number[];
  /** The story feed, oldest first. */
  readonly story: readonly StoryEntry[];
  /** How many hint tiers are showing for each objective (0 to 3). Hints are free. */
  readonly hintsShown: Readonly<Record<string, number>>;
  /** Artefact refs pinned to the case board, oldest first. Pins from anywhere land here. */
  readonly pins: readonly string[];
  /** The player's own notes on the case. */
  readonly notes: string;
  /**
   * The report draft, by question id, plus `summary` for the free text the report ends with (and
   * is, for a case with no questions).
   */
  readonly reportDraft: Readonly<Record<string, string>>;
  /** The pins each report answer cites as its supporting evidence, by question id. */
  readonly citations: Readonly<Record<string, readonly string[]>>;
  /** The player's note on each pin, by ref. */
  readonly pinNotes: Readonly<Record<string, string>>;
  /**
   * What the chain of custody records that the engine's events don't: pins made from a view and
   * each report submission, placed by how many events came before them (custody/custody-log.ts).
   */
  readonly marks: readonly RunMark[];
}

export type CaseRunAction =
  /** Start case: from the briefing into the workspace, with the workstation's starting state. */
  | { readonly type: "start"; readonly sim: SimState }
  /**
   * Opening a case with a save: straight into the saved phase, with everything the player wrote
   * and earned. The workstation starts fresh; replaying the log (`command` actions) catches it up.
   */
  | { readonly type: "restore"; readonly save: CaseRunSave; readonly sim: SimState }
  /**
   * The player typed a line, pressed Reset machine or opened an image in the Evidence Browser: it
   * goes in the log for replay.
   */
  | { readonly type: "log"; readonly entry: LogEntry }
  /**
   * A command ran in the terminal: its events and the engine's new state. `replay` marks the
   * commands a restore replays: their `board.pinned` events don't pin again, because the save's
   * pins already say what's pinned (and a pin removed since stays removed).
   */
  | {
      readonly type: "command";
      readonly events: readonly SimEvent[];
      readonly sim: SimState;
      readonly replay?: boolean;
    }
  /** Reset machine: the workstation's starting state again. Ticks already earned stay. */
  | { readonly type: "reset"; readonly sim: SimState }
  /** Show the next hint tier for an objective. */
  | { readonly type: "hint"; readonly objectiveId: string }
  /** A pin from a view (the terminal's `pin` arrives as an event). `note` comes back on an undo. */
  | { readonly type: "pin"; readonly ref: string; readonly note?: string }
  /** Take a pin off the board. Its note goes with it. */
  | { readonly type: "unpin"; readonly ref: string }
  /** A pin's note changed. Empty text removes it. */
  | { readonly type: "pinNote"; readonly ref: string; readonly text: string }
  /** The pins a report answer cites as its supporting evidence. */
  | { readonly type: "cite"; readonly questionId: string; readonly refs: readonly string[] }
  /** The player's notes changed. */
  | { readonly type: "notes"; readonly text: string }
  /** A report answer changed. Empty text removes it. */
  | { readonly type: "draft"; readonly questionId: string; readonly text: string }
  /**
   * Write the report: from the workspace, once every main objective is done, or straight back
   * from the debrief to change it and submit again.
   */
  | { readonly type: "report" }
  /** Submit report: on to the debrief, as often as the player likes. */
  | { readonly type: "submitReport" }
  /** Back to the workspace from the report or the debrief, to keep looking. */
  | { readonly type: "resume" }
  /** Start the case again: back to the briefing with a fresh run. */
  | { readonly type: "restart" };

export { HINT_TIERS };

export function createCaseRun(attempt = 0): CaseRunState {
  return {
    phase: "briefing",
    attempt,
    sim: null,
    events: [],
    log: [],
    completed: [],
    beatsPlayed: [],
    story: [],
    hintsShown: {},
    pins: [],
    notes: "",
    reportDraft: {},
    citations: {},
    pinNotes: {},
    marks: [],
  };
}

export interface CaseRunReducerOptions {
  /** Which objectives hold. The browser's evaluator unless a test passes its own. */
  readonly evaluate?: ObjectiveEvaluator;
}

/** Every change to a run. Pure: the same case, run and action always give the same result. */
export function caseRunReducer(
  caseDef: RunnableCase,
  run: CaseRunState,
  action: CaseRunAction,
  { evaluate = evaluateObjectives }: CaseRunReducerOptions = {},
): CaseRunState {
  const playing = run.phase !== "briefing";
  switch (action.type) {
    case "start": {
      if (playing) return run;
      const started: CaseRunState = { ...run, phase: "workspace", sim: action.sim };
      return advance(caseDef, playBeats(caseDef, started, beatsOn(caseDef, "start")), evaluate);
    }
    case "restore": {
      if (playing) return run;
      const { save } = action;
      const known = (id: string) => caseDef.objectives.some((objective) => objective.id === id);
      const beatsPlayed = save.beatsPlayed.filter((index) => index < caseDef.story.length);
      const restored: CaseRunState = {
        ...run,
        phase: save.phase,
        sim: action.sim,
        log: save.log,
        completed: save.completed.filter(known),
        beatsPlayed: [],
        story: [],
        hintsShown: Object.fromEntries(Object.entries(save.hintsShown).filter(([id]) => known(id))),
        pins: save.pins,
        notes: save.notes,
        reportDraft: save.reportDraft,
        citations: save.citations,
        pinNotes: save.pinNotes,
        marks: save.marks,
      };
      return playBeats(caseDef, restored, beatsPlayed);
    }
    case "log":
      if (!playing || run.log.length >= MAX_LOG_ENTRIES) return run;
      // An absurdly long pasted line is cut to what a save may hold, so the save still validates.
      return {
        ...run,
        log: [...run.log, clip(action.entry)],
      };
    case "command": {
      if (!playing) return run;
      // `pin` in the terminal lands on the same board as a pin from a view.
      const pinned = action.replay
        ? []
        : action.events.flatMap((event) => (event.type === "board.pinned" ? [event.ref] : []));
      const pins = pinned.reduce<readonly string[]>(
        (list, ref) => (list.includes(ref) || list.length >= MAX_PINS ? list : [...list, ref]),
        run.pins,
      );
      // `pin -m "..."` writes the pin's first note; a note the player has written since stays.
      const pinNotes = { ...run.pinNotes };
      for (const event of action.replay ? [] : action.events) {
        if (event.type === "board.pinned" && event.note && pinNotes[event.ref] === undefined) {
          pinNotes[event.ref] = event.note.slice(0, MAX_PIN_NOTE_LENGTH);
        }
      }
      return advance(
        caseDef,
        { ...run, sim: action.sim, events: [...run.events, ...action.events], pins, pinNotes },
        evaluate,
      );
    }
    case "reset":
      return playing ? { ...run, sim: action.sim } : run;
    case "hint": {
      const shown = run.hintsShown[action.objectiveId] ?? 0;
      const exists = caseDef.objectives.some((objective) => objective.id === action.objectiveId);
      if (shown >= HINT_TIERS || !exists) return run;
      return { ...run, hintsShown: { ...run.hintsShown, [action.objectiveId]: shown + 1 } };
    }
    case "pin": {
      if (!playing || run.pins.includes(action.ref) || run.pins.length >= MAX_PINS) return run;
      const note = action.note?.slice(0, MAX_PIN_NOTE_LENGTH);
      return advance(
        caseDef,
        {
          ...run,
          pins: [...run.pins, action.ref],
          pinNotes: note?.trim() ? { ...run.pinNotes, [action.ref]: note } : run.pinNotes,
          marks: mark(run, { after: run.events.length, kind: "pinned", ref: action.ref }),
        },
        evaluate,
      );
    }
    case "unpin":
      return run.pins.includes(action.ref)
        ? {
            ...run,
            pins: run.pins.filter((ref) => ref !== action.ref),
            pinNotes: without(run.pinNotes, action.ref),
          }
        : run;
    case "pinNote": {
      if (!playing || !run.pins.includes(action.ref)) return run;
      const text = action.text.slice(0, MAX_PIN_NOTE_LENGTH);
      const others = without(run.pinNotes, action.ref);
      return { ...run, pinNotes: text.trim() === "" ? others : { ...others, [action.ref]: text } };
    }
    case "cite": {
      if (!playing) return run;
      const refs = action.refs
        .filter((ref, index) => action.refs.indexOf(ref) === index)
        .slice(0, MAX_PINS);
      const others = without(run.citations, action.questionId);
      const citations = refs.length === 0 ? others : { ...others, [action.questionId]: refs };
      // A newly cited pin can support an answer, and so tick a `reported` objective.
      return advance(caseDef, { ...run, citations }, evaluate);
    }
    case "notes":
      return playing ? { ...run, notes: action.text.slice(0, MAX_NOTES_LENGTH) } : run;
    case "draft": {
      if (!playing) return run;
      const reportDraft: Record<string, string> = { ...run.reportDraft };
      const text = action.text.slice(0, MAX_DRAFT_LENGTH);
      if (text.trim() === "") delete reportDraft[action.questionId];
      else reportDraft[action.questionId] = text;
      // A supported answer can tick a `reported` objective.
      return advance(caseDef, { ...run, reportDraft }, evaluate);
    }
    case "report":
      return (run.phase === "workspace" && isCaseComplete(caseDef, run.completed)) ||
        run.phase === "debrief"
        ? { ...run, phase: "report" }
        : run;
    case "submitReport": {
      if (run.phase !== "report") return run;
      const findings = gradeReport(
        caseDef.report ?? { questions: [] },
        reportAnswers(run.reportDraft, run.citations),
        run.pins,
      );
      return {
        ...run,
        phase: "debrief",
        marks: mark(run, {
          after: run.events.length,
          kind: "submitted",
          supported: supportedCount(findings),
          total: findings.length,
        }),
      };
    }
    case "resume":
      return run.phase === "report" || run.phase === "debrief"
        ? { ...run, phase: "workspace" }
        : run;
    case "restart":
      return createCaseRun(run.attempt + 1);
  }
}

/** The run's custody marks with one more, while there's room for it in a save. */
const mark = (run: CaseRunState, entry: RunMark): readonly RunMark[] =>
  run.marks.length >= MAX_MARKS ? run.marks : [...run.marks, entry];

/** A copy of a record without one key. */
function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const copy: Record<string, T> = { ...record };
  delete copy[key];
  return copy;
}

/** A log entry cut to what a save may hold, so the save still validates. */
function clip(entry: LogEntry): LogEntry {
  if ("line" in entry) return { line: entry.line.slice(0, MAX_LINE_LENGTH) };
  if ("browse" in entry) return { browse: entry.browse.slice(0, MAX_LINE_LENGTH) };
  return entry;
}

function beatsOn(caseDef: RunnableCase, on: "start" | "complete"): number[] {
  return caseDef.story.flatMap((beat, index) => (beat.on === on ? [index] : []));
}

/** Adds these story lines to the feed, once each, in the order given. */
function playBeats(
  caseDef: RunnableCase,
  run: CaseRunState,
  indexes: readonly number[],
): CaseRunState {
  const fresh = indexes.filter(
    (index, at) => !run.beatsPlayed.includes(index) && indexes.indexOf(index) === at,
  );
  if (fresh.length === 0) return run;
  let nextId = run.story.length;
  return {
    ...run,
    beatsPlayed: [...run.beatsPlayed, ...fresh],
    story: [
      ...run.story,
      ...fresh.flatMap((index) => {
        const beat = caseDef.story[index];
        return beat ? [{ id: nextId++, speaker: beat.speaker, text: beat.text }] : [];
      }),
    ],
  };
}

/**
 * Re-checks the objectives against every event so far, keeps every tick earned, and plays the story lines newly ticked
 * objectives trigger (objective order, then story order), then the `complete` lines if the case
 * just finished.
 */
function advance(
  caseDef: RunnableCase,
  run: CaseRunState,
  evaluate: ObjectiveEvaluator,
): CaseRunState {
  const holding = evaluate(caseDef, run.events, run);
  const newlyTicked = holding.filter((id) => !run.completed.includes(id));
  if (newlyTicked.length === 0) return run;
  const wasComplete = isCaseComplete(caseDef, run.completed);
  const completed = [...run.completed, ...newlyTicked];

  const beats: number[] = [];
  for (const id of newlyTicked) {
    caseDef.story.forEach((beat, index) => {
      if (typeof beat.on === "object" && beat.on.objective === id) beats.push(index);
    });
  }
  if (!wasComplete && isCaseComplete(caseDef, completed))
    beats.push(...beatsOn(caseDef, "complete"));

  return playBeats(caseDef, { ...run, completed }, beats);
}

// ---------------------------------------------------------------------------------------------
// What the runner shows, and what's saved
// ---------------------------------------------------------------------------------------------

/** The first main objective not ticked yet: where the player is in the case. */
export function currentObjective(
  caseDef: RunnableCase,
  run: CaseRunState,
): CaseObjective | undefined {
  return caseDef.objectives.find(
    (objective) =>
      !objective.optional && !objective.hidden && !run.completed.includes(objective.id),
  );
}

/**
 * The checklist: main and bonus objectives in case order, then the secrets found so far. Secrets
 * stay off the list until they're found.
 */
export function visibleObjectives(caseDef: RunnableCase, run: CaseRunState): CaseObjective[] {
  return [
    ...caseDef.objectives.filter((objective) => !objective.hidden),
    ...run.completed
      .map((id) => caseDef.objectives.find((objective) => objective.id === id))
      .filter((objective): objective is CaseObjective => objective?.hidden === true),
  ];
}

/**
 * What's kept of a run between visits, or undefined for a run still on its briefing (nothing to
 * keep). `savedAt` comes in from the page, so this stays pure.
 */
export function toSave(run: CaseRunState, savedAt: number): CaseRunSave | undefined {
  if (run.phase === "briefing") return undefined;
  return {
    phase: run.phase,
    log: [...run.log],
    pins: [...run.pins],
    notes: run.notes,
    reportDraft: { ...run.reportDraft },
    completed: [...run.completed],
    hintsShown: { ...run.hintsShown },
    beatsPlayed: [...run.beatsPlayed],
    citations: Object.fromEntries(
      Object.entries(run.citations).map(([id, refs]) => [id, [...refs]]),
    ),
    pinNotes: { ...run.pinNotes },
    marks: [...run.marks],
    savedAt: Math.max(0, Math.floor(savedAt)),
  };
}
