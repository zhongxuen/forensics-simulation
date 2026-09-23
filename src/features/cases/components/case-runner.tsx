"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import type { CaseRunSave, CaseStorage, SaveStatus } from "@/lib/case-storage";
import type { RunnableCase } from "../run/case-definition";
import type { CaseRunAction, CaseRunState } from "../run/case-run";
import { useCaseRun } from "../run/use-case-run";
import { CaseBriefing } from "./case-briefing";

/**
 * Everything after Start case (the engine, the terminal, the workspace, the report and the
 * debrief) is one chunk, loaded on demand. The promise is kept, so warming it up during the
 * briefing and rendering it later share one download.
 */
let casePlayModule: Promise<typeof import("./case-play")> | undefined;
const loadCasePlay = () => (casePlayModule ??= import("./case-play"));
const CasePlay = lazy(loadCasePlay);

export interface CaseRunnerProps {
  caseDef: RunnableCase;
  /** Where runs are saved. The browser's, unless a test passes its own. */
  storage?: CaseStorage;
}

/**
 * The case runner (docs/plan/05-workspace-ui.md §Case runner): briefing, then workspace, then
 * report, then debrief, all driven by the case object, with no case-specific code. Modelled on
 * Hacker Simulation's MissionRunner.
 *
 * A case with a save in this browser opens where the player left it: the play chunk loads at
 * once and replays the save. Start the case again starts a new attempt: a fresh store, a fresh
 * terminal, and the save forgotten.
 */
export function CaseRunner({ caseDef, storage }: CaseRunnerProps) {
  const { run, dispatch, saved, saveStatus } = useCaseRun(caseDef, storage ? { storage } : {});
  return (
    <CaseAttempt
      key={run.attempt}
      caseDef={caseDef}
      run={run}
      dispatch={dispatch}
      saved={run.attempt === 0 ? saved : null}
      saveStatus={saveStatus}
    />
  );
}

interface CaseAttemptProps {
  caseDef: RunnableCase;
  run: CaseRunState;
  dispatch: (action: CaseRunAction) => void;
  saved: CaseRunSave | null | undefined;
  saveStatus: SaveStatus;
}

function CaseAttempt({ caseDef, run, dispatch, saved, saveStatus }: CaseAttemptProps) {
  const [starting, setStarting] = useState(false);

  // Warm up the play chunk while the player reads the briefing, so Start case is instant.
  useEffect(() => {
    const warm = () => void loadCasePlay().catch(() => {});
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  // Moving between briefing, workspace and report puts focus on the new screen's heading (the
  // debrief focuses its own). On the page's first render focus stays put.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstPhase = useRef(true);
  useEffect(() => {
    if (firstPhase.current) {
      firstPhase.current = false;
      if (run.attempt === 0) return;
    }
    if (run.phase !== "debrief") headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [run.phase, run.attempt]);

  const briefing = (
    <CaseBriefing
      caseDef={caseDef}
      headingRef={headingRef}
      starting={starting}
      onStart={() => setStarting(true)}
    />
  );
  const resuming = saved != null;
  if (!starting && !resuming) return briefing;
  return (
    <Suspense fallback={resuming ? <OpeningCase /> : briefing}>
      <CasePlay
        caseDef={caseDef}
        run={run}
        dispatch={dispatch}
        headingRef={headingRef}
        saveStatus={saveStatus}
        {...(resuming && { restoreFrom: saved })}
      />
    </Suspense>
  );
}

function OpeningCase() {
  return (
    <p role="status" className="flex items-center gap-3 py-16 text-secondary">
      <Spinner />
      Opening your case where you left it…
    </p>
  );
}
