"use client";

import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  caseStorage,
  type CaseRunSave,
  type CaseStorage,
  type SaveStatus,
} from "@/lib/case-storage";
import type { RunnableCase } from "./case-definition";
import {
  caseRunReducer,
  createCaseRun,
  toSave,
  type CaseRunAction,
  type CaseRunState,
} from "./case-run";

export interface CaseRun {
  readonly run: CaseRunState;
  readonly dispatch: (action: CaseRunAction) => void;
  /**
   * The run saved in this browser when the page opened: `undefined` until the page has hydrated
   * (the server can't see storage), then the save, or `null` if there was none. Replaying it is
   * the play chunk's job (components/case-play.tsx).
   */
  readonly saved: CaseRunSave | null | undefined;
  /** How the latest save went: `blocked` shows the "isn't letting us save" banner. */
  readonly saveStatus: SaveStatus;
}

export interface UseCaseRunOptions {
  /** Where runs are saved. The browser's, unless a test passes its own. */
  readonly storage?: CaseStorage;
}

const serverStatus = (): SaveStatus => "unknown";

/**
 * The one store for a case run: the pure reducer, held by React, and saved in this browser after
 * every change (docs/plan/05-workspace-ui.md §Saving case runs). When storage is blocked or full,
 * the run carries on in memory and `saveStatus` says so. Restarting the case forgets the save.
 * Give the component using it a `key` per case.
 */
export function useCaseRun(
  caseDef: RunnableCase,
  { storage = caseStorage }: UseCaseRunOptions = {},
): CaseRun {
  const reducer = useCallback(
    (run: CaseRunState, action: CaseRunAction) => caseRunReducer(caseDef, run, action),
    [caseDef],
  );
  const [run, dispatch] = useReducer(reducer, undefined, () => createCaseRun());

  // What was saved when the page opened, read once the page has hydrated (adjusting state while
  // rendering, so the server and the first browser render agree).
  const hydrated = useHydrated();
  const [saved, setSaved] = useState<CaseRunSave | null | undefined>(undefined);
  if (hydrated && saved === undefined) setSaved(storage.load(caseDef.id) ?? null);

  useEffect(() => {
    if (run.phase === "briefing") {
      // Start the case again forgets the old run. A page that opens on the briefing keeps it.
      if (run.attempt > 0) storage.remove(caseDef.id);
      return;
    }
    const save = toSave(run, Date.now());
    if (save) storage.save(caseDef.id, save);
  }, [storage, caseDef.id, run]);

  const saveStatus = useSyncExternalStore(storage.subscribe, storage.saveStatus, serverStatus);

  return { run, dispatch, saved, saveStatus };
}
