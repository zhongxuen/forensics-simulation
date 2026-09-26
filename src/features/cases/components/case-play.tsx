"use client";

import { use, useCallback, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import type { CaseRunSave, SaveStatus } from "@/lib/case-storage";
import {
  buildMentorTranscript,
  REVIEW_TRANSCRIPT_LIMITS,
  useMentorSession,
} from "@/features/mentor";
import { useTerminalSession, type TerminalSession } from "@/features/terminal";
import type { SimEvent, SimState } from "@/sim/types";
import type { RunnableCase } from "../run/case-definition";
import type { CaseRunAction, CaseRunState } from "../run/case-run";
import { caseEvidence } from "../run/evidence";
import { browseChange, evidenceSetup } from "../run/workstation";
import { DebriefScreen } from "./debrief/debrief-screen";
import { ReportScreen } from "./report/report-screen";
import { CaseWorkspace } from "./case-workspace";

export interface CasePlayProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  saveStatus: SaveStatus;
  /** A save to pick up from, instead of starting fresh. */
  restoreFrom?: CaseRunSave;
}

/**
 * Everything after Start case: the workstation (the engine, through the terminal session), the
 * workspace, the report and the debrief. The runner loads this module only once it's needed, so
 * the briefing page stays small (the 200 KB budget). One attempt's terminal session lives here,
 * across workspace, report and debrief, so the screen is still there when the player goes back.
 *
 * The case's evidence arrives as its own chunk (00 §4 row 12) and is attached to the workstation
 * before it starts, as devices under /dev/evidence with their write-blockers on, so the disk tools
 * and the Evidence Browser read the same engine state. Until it has arrived this suspends, and the
 * runner keeps showing the briefing.
 *
 * Opening a case with a save replays its log through the session, entry by entry, before the
 * first paint: the same parser, engine and in-world clock as when it was typed, so the machine
 * and the screen come back as they were, and the events re-tick nothing that wasn't ticked.
 *
 * Noor lives here too (docs/plan/14-mentor.md), for the same reason the terminal session does: one
 * mentor per attempt, across the workspace, the report and the debrief, so closing her panel or
 * going back and forth to the debrief never asks the model again. `CaseRunner` keys this component
 * per attempt, so "Start the case again" starts a fresh one; what she said is held in memory only
 * and is never part of the save.
 */
export default function CasePlay({
  caseDef,
  run,
  dispatch,
  headingRef,
  saveStatus,
  restoreFrom,
}: CasePlayProps) {
  const evidence = use(caseEvidence(caseDef.id));
  // True while a save's log is being replayed, so its pins aren't pinned a second time.
  const replaying = useRef(false);
  const onEvents = useCallback(
    (events: readonly SimEvent[], sim: SimState) =>
      dispatch({ type: "command", events, sim, replay: replaying.current }),
    [dispatch],
  );
  const onReset = useCallback((sim: SimState) => dispatch({ type: "reset", sim }), [dispatch]);
  const setup = useMemo(
    () => (evidence ? evidenceSetup(caseDef.scenario, evidence) : undefined),
    [caseDef.scenario, evidence],
  );
  const mentor = useMentorSession(caseDef);
  const session = useTerminalSession({
    scenario: caseDef.scenario,
    seed: caseDef.seed,
    onEvents,
    onReset,
    ...(setup && { setup }),
  });

  // Start (or pick up) the run once, before the first paint, so the player goes straight from
  // the briefing to the workspace. The ref keeps a development double-run from replaying twice.
  const begun = useRef(false);
  const briefing = run.phase === "briefing";
  useLayoutEffect(() => {
    if (!briefing || begun.current) return;
    begun.current = true;
    if (!restoreFrom) {
      dispatch({ type: "start", sim: session.sim });
      return;
    }
    dispatch({ type: "restore", save: restoreFrom, sim: session.sim });
    replaying.current = true;
    for (const entry of restoreFrom.log) {
      if ("reset" in entry) session.reset();
      else if ("browse" in entry) session.apply(browseChange(entry.browse));
      else session.submit(entry.line);
    }
    replaying.current = false;
  }, [briefing, dispatch, restoreFrom, session]);

  // What the player types goes in the run's log (for the save) as well as to the engine. Replay
  // above calls the session directly, so it never logs a line twice.
  const logged = useMemo<TerminalSession>(
    () => ({
      ...session,
      submit: (line) => {
        dispatch({ type: "log", entry: { line } });
        return session.submit(line);
      },
      reset: () => {
        dispatch({ type: "log", entry: { reset: true } });
        session.reset();
      },
    }),
    [session, dispatch],
  );

  // The Evidence Browser opens an image through the engine, and the open goes in the log, like a
  // typed line: opening an original with its write-blocker off changes it, so a save replays it.
  const browse = useCallback(
    (path: string) => {
      const opened = session.apply(browseChange(path));
      if (opened) dispatch({ type: "log", entry: { browse: path } });
      return opened;
    },
    [session, dispatch],
  );

  switch (run.phase) {
    case "briefing":
      return null;
    case "report":
      return (
        <ReportScreen
          caseDef={caseDef}
          run={run}
          dispatch={dispatch}
          evidence={evidence}
          headingRef={headingRef}
        />
      );
    case "debrief":
      return (
        <DebriefScreen
          caseDef={caseDef}
          run={run}
          dispatch={dispatch}
          evidence={evidence}
          mentor={mentor}
          commandLines={commandLines(run.log)}
          transcript={buildMentorTranscript(session.blocks, REVIEW_TRANSCRIPT_LIMITS)}
        />
      );
    case "workspace":
      return (
        <CaseWorkspace
          caseDef={caseDef}
          run={run}
          dispatch={dispatch}
          session={logged}
          browse={browse}
          evidence={evidence}
          headingRef={headingRef}
          saveStatus={saveStatus}
          mentor={mentor}
        />
      );
  }
}

/** Every line the player typed this attempt, oldest first, for the review's run facts. */
function commandLines(log: CaseRunState["log"]): string[] {
  return log.flatMap((entry) => ("line" in entry ? [entry.line] : []));
}
