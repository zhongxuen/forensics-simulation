"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { MentorCaseRef } from "../client";
import { createMentorStore, type MentorSession } from "./mentor-store";

/**
 * The mentor for one case attempt, held in memory (docs/plan/14-mentor.md). Call it where the
 * attempt lives, so it survives moving between the workspace, the report and the debrief; give that
 * component a `key` per attempt so "Start the case again" starts a fresh one. Requests still in
 * flight are stopped when the attempt ends.
 *
 * Vendored from `../hacker-simulation/src/features/mentor/session/use-mentor-session.ts`
 * (VENDORED.md), taking a `MentorCaseRef` where the sibling took a `Mission`.
 */
export function useMentorSession(caseDef: MentorCaseRef): MentorSession {
  const [store] = useState(() => createMentorStore(caseDef));
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  useEffect(() => () => store.abortAll(), [store]);
  return useMemo(
    () => ({
      state,
      askHint: store.askHint,
      explain: store.explain,
      requestReview: store.requestReview,
    }),
    [state, store],
  );
}
