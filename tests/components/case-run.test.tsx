import { describe, expect, it } from "vitest";
import {
  caseRunReducer,
  createCaseRun,
  PRACTICE_CASE,
  replayLog,
  toSave,
  visibleObjectives,
  type CaseRunAction,
  type CaseRunState,
} from "@/features/cases";
import { createTerminalSession, submitLine } from "@/features/terminal";
import { MAX_LINE_LENGTH } from "@/lib/case-storage";

/**
 * The case run reducer (docs/plan/05-workspace-ui.md §Case runner), driven the way the runner
 * drives it: typed lines go through the terminal's own session code to the engine, and their
 * events come back as `command` actions. The practice case uses workstation commands only, so it
 * runs with the stub evaluator.
 */

const CASE = PRACTICE_CASE;
const reduce = (run: CaseRunState, action: CaseRunAction) => caseRunReducer(CASE, run, action);

/** Starts the practice case and types `lines`, logging each one as the runner does. */
function play(lines: readonly string[], from?: CaseRunState) {
  let terminal = createTerminalSession({ scenario: CASE.scenario, seed: CASE.seed });
  let run = from ?? reduce(createCaseRun(), { type: "start", sim: terminal.sim });
  for (const line of lines) {
    run = reduce(run, { type: "log", entry: { line } });
    terminal = submitLine(terminal, line);
    run = reduce(run, { type: "command", events: terminal.lastEvents, sim: terminal.sim });
  }
  return { run, terminal };
}

const READ_LETTER = "cat cases/practice/letter.txt";
const FIND_SEAL = "grep Sealed cases/practice/handover.txt";

describe("caseRunReducer", () => {
  it("starts in the briefing, and Start case opens the workspace with the start story line", () => {
    const fresh = createCaseRun();
    expect(fresh.phase).toBe("briefing");

    const { run } = play([]);
    expect(run.phase).toBe("workspace");
    expect(run.story.map((entry) => entry.speaker)).toEqual(["teammate-kit"]);
    expect(run.completed).toEqual([]);
  });

  it("ignores everything but Start case (and restore) while on the briefing", () => {
    const fresh = createCaseRun();
    expect(reduce(fresh, { type: "log", entry: { line: "ls" } })).toBe(fresh);
    expect(reduce(fresh, { type: "notes", text: "hi" })).toBe(fresh);
    expect(reduce(fresh, { type: "pin", ref: "log:security/1" })).toBe(fresh);
    expect(reduce(fresh, { type: "report" })).toBe(fresh);
  });

  it("ticks objectives from engine events and plays the lines they trigger, once", () => {
    const { run } = play([READ_LETTER, READ_LETTER]);
    expect(run.completed).toEqual(["read-letter"]);
    expect(run.story.map((entry) => entry.speaker)).toEqual(["teammate-kit", "mentor-noor"]);
  });

  it("plays the completion line when the last main objective ticks, and keeps ticks after a reset", () => {
    let { run, terminal } = play([READ_LETTER, FIND_SEAL]);
    expect(run.completed).toEqual(["read-letter", "find-seal"]);
    expect(run.story.at(-1)?.speaker).toBe("teammate-theo");

    terminal = createTerminalSession({ scenario: CASE.scenario, seed: CASE.seed });
    run = reduce(run, { type: "reset", sim: terminal.sim });
    expect(run.completed).toEqual(["read-letter", "find-seal"]);
  });

  it("keeps secrets and bonuses honest: a bonus shows from the start and ticks when found", () => {
    const { run } = play(["ls -a cases/practice", "cat cases/practice/.kit-notes.txt"]);
    expect(run.completed).toEqual(["hidden-notes"]);
    expect(visibleObjectives(CASE, run).map((objective) => objective.id)).toContain("hidden-notes");
  });

  it("does not tick on a command that didn't work", () => {
    const { run } = play(["grep Sealed cases/practice/no-such-file.txt"]);
    expect(run.completed).toEqual([]);
  });

  it("shows hint tiers one at a time, up to three, and changes nothing else", () => {
    let { run } = play([]);
    const before = run;
    for (let i = 0; i < 5; i++) run = reduce(run, { type: "hint", objectiveId: "read-letter" });
    expect(run.hintsShown).toEqual({ "read-letter": 3 });
    expect({ ...run, hintsShown: {} }).toEqual({ ...before, hintsShown: {} });
    expect(reduce(run, { type: "hint", objectiveId: "no-such-objective" })).toBe(run);
  });

  it("keeps pins once each, from anywhere, and unpins", () => {
    let { run } = play([]);
    run = reduce(run, { type: "pin", ref: "disk:qf-lt-03:mft/64" });
    run = reduce(run, { type: "pin", ref: "log:security/2" });
    run = reduce(run, { type: "pin", ref: "disk:qf-lt-03:mft/64" });
    expect(run.pins).toEqual(["disk:qf-lt-03:mft/64", "log:security/2"]);
    run = reduce(run, { type: "unpin", ref: "disk:qf-lt-03:mft/64" });
    expect(run.pins).toEqual(["log:security/2"]);
  });

  it("pins what the terminal's `pin` pins, onto the same board, but not again on a replay", () => {
    const { terminal } = play([]);
    let { run } = play([]);
    const pinned = {
      type: "board.pinned",
      ref: "disk:qf-lt-03:mft/64",
      line: "64  C:\\Users\\yard\\Downloads\\invoice-viewer.exe",
    } as const;
    run = reduce(run, { type: "pin", ref: "log:security/2" });
    run = reduce(run, { type: "command", events: [pinned], sim: terminal.sim });
    run = reduce(run, { type: "command", events: [pinned], sim: terminal.sim });
    expect(run.pins).toEqual(["log:security/2", "disk:qf-lt-03:mft/64"]);

    // Unpinned since, and the save's log replays the `pin` command: it stays unpinned.
    run = reduce(run, { type: "unpin", ref: "disk:qf-lt-03:mft/64" });
    run = reduce(run, { type: "command", events: [pinned], sim: terminal.sim, replay: true });
    expect(run.pins).toEqual(["log:security/2"]);
  });

  it("keeps notes and report answers, and drops an emptied answer", () => {
    let { run } = play([]);
    run = reduce(run, { type: "notes", text: "Seal matches." });
    run = reduce(run, { type: "draft", questionId: "summary", text: "Nothing was opened." });
    expect(run.notes).toBe("Seal matches.");
    expect(run.reportDraft).toEqual({ summary: "Nothing was opened." });
    run = reduce(run, { type: "draft", questionId: "summary", text: "   " });
    expect(run.reportDraft).toEqual({});
  });

  it("logs every typed line and Reset machine press, cutting an absurdly long line", () => {
    let { run } = play(["ls", ""]);
    run = reduce(run, { type: "log", entry: { reset: true } });
    run = reduce(run, { type: "log", entry: { line: "x".repeat(MAX_LINE_LENGTH + 50) } });
    expect(run.log.slice(0, 3)).toEqual([{ line: "ls" }, { line: "" }, { reset: true }]);
    expect(run.log[3]).toEqual({ line: "x".repeat(MAX_LINE_LENGTH) });
  });

  it("opens the report only once the main objectives are done, then the debrief", () => {
    let { run } = play([READ_LETTER]);
    expect(reduce(run, { type: "report" })).toBe(run);
    run = play([FIND_SEAL], run).run;
    run = reduce(run, { type: "report" });
    expect(run.phase).toBe("report");
    run = reduce(run, { type: "resume" });
    expect(run.phase).toBe("workspace");
    run = reduce(reduce(run, { type: "report" }), { type: "submitReport" });
    expect(run.phase).toBe("debrief");
    expect(reduce(run, { type: "resume" }).phase).toBe("workspace");
  });

  it("restarts as a fresh attempt on the briefing", () => {
    const { run } = play([READ_LETTER]);
    const restarted = reduce(run, { type: "restart" });
    expect(restarted).toEqual(createCaseRun(1));
  });
});

describe("saving and restoring a run", () => {
  it("saves nothing for a run on its briefing", () => {
    expect(toSave(createCaseRun(), 1)).toBeUndefined();
  });

  it("brings back the phase, ticks, story, hints, pins, notes and draft, and replays the log to the same machine", () => {
    const played = play([READ_LETTER, "cd cases/practice", "grep Sealed handover.txt"]);
    const { terminal } = played;
    let { run } = played;
    run = reduce(run, { type: "hint", objectiveId: "hidden-notes" });
    run = reduce(run, { type: "pin", ref: "log:security/2" });
    run = reduce(run, { type: "notes", text: "Seal QF-0412 matches." });
    run = reduce(run, { type: "report" });
    run = reduce(run, { type: "draft", questionId: "summary", text: "All in order." });
    const save = toSave(run, 1_770_000_000_000);
    expect(save).toBeDefined();
    if (!save) return;
    // What's saved is data only: no engine state, no events.
    expect(Object.keys(save).sort()).toEqual(
      [
        "beatsPlayed",
        "completed",
        "hintsShown",
        "log",
        "notes",
        "phase",
        "pins",
        "reportDraft",
        "savedAt",
      ].sort(),
    );

    // Opening the case again: restore, then replay the log through the terminal.
    const fresh = createTerminalSession({ scenario: CASE.scenario, seed: CASE.seed });
    let restored = reduce(createCaseRun(), { type: "restore", save, sim: fresh.sim });
    const replayed = replayLog(CASE, save.log, (session) => {
      restored = reduce(restored, {
        type: "command",
        events: session.lastEvents,
        sim: session.sim,
      });
    });

    expect(restored.phase).toBe("report");
    expect(restored.completed).toEqual(run.completed);
    expect(restored.story).toEqual(run.story);
    expect(restored.hintsShown).toEqual(run.hintsShown);
    expect(restored.pins).toEqual(run.pins);
    expect(restored.notes).toBe(run.notes);
    expect(restored.reportDraft).toEqual(run.reportDraft);
    expect(restored.log).toEqual(run.log);
    // The same machine and the same screen as the live session.
    expect(replayed.sim).toEqual(terminal.sim);
    expect(replayed.blocks).toEqual(terminal.blocks);
    expect(restored.sim).toEqual(terminal.sim);
  });

  it("drops ticks and hints for objectives the case no longer has", () => {
    const fresh = createTerminalSession({ scenario: CASE.scenario, seed: CASE.seed });
    const restored = reduce(createCaseRun(), {
      type: "restore",
      sim: fresh.sim,
      save: {
        phase: "workspace",
        log: [],
        pins: [],
        notes: "",
        reportDraft: {},
        completed: ["read-letter", "retired-objective"],
        hintsShown: { "retired-objective": 2, "find-seal": 1 },
        beatsPlayed: [0, 99],
        savedAt: 0,
      },
    });
    expect(restored.completed).toEqual(["read-letter"]);
    expect(restored.hintsShown).toEqual({ "find-seal": 1 });
    expect(restored.beatsPlayed).toEqual([0]);
  });
});
