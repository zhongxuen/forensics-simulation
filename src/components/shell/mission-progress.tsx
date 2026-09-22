"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";

export interface MissionProgress {
  /** Objectives completed so far in this mission run. */
  readonly done: number;
  /** Main objectives in the mission. Bonus and hidden ones don't count. */
  readonly total: number;
}

interface MissionProgressSlot {
  readonly progress: MissionProgress | null;
  readonly setProgress: (progress: MissionProgress | null) => void;
}

const MissionProgressContext = createContext<MissionProgressSlot | null>(null);

function useMissionProgressSlot(component: string): MissionProgressSlot {
  const slot = useContext(MissionProgressContext);
  if (!slot) throw new Error(`${component} must be rendered inside the app shell.`);
  return slot;
}

/** Holds the top bar's mission-progress slot. The app shell renders it around everything. */
export function MissionProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<MissionProgress | null>(null);
  const slot = useMemo(() => ({ progress, setProgress }), [progress]);
  return <MissionProgressContext value={slot}>{children}</MissionProgressContext>;
}

/**
 * Shows the current mission's progress in the top bar while this is rendered. A mission page
 * renders it once a run starts (phase 06); unmounting it (leaving the mission) clears the slot.
 * Renders nothing itself.
 */
export function ShowMissionProgress({ done, total }: MissionProgress) {
  const { setProgress } = useMissionProgressSlot("ShowMissionProgress");

  useEffect(() => {
    setProgress({ done, total });
  }, [setProgress, done, total]);

  useEffect(() => () => setProgress(null), [setProgress]);

  return null;
}

/** The top bar's slot: empty outside a mission. */
export function MissionProgressIndicator() {
  const { progress } = useMissionProgressSlot("MissionProgressIndicator");
  return progress && <MissionProgressSummary {...progress} />;
}

/** Objectives done in the current mission: a small ring and a count. */
export function MissionProgressSummary({ done, total }: MissionProgress) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ProgressRing value={done} max={total} label="Objectives done" size="sm" />
      <span aria-hidden="true" className="hidden text-sm text-secondary tabular-nums sm:inline">
        {Math.min(done, total)} of {total} objectives
      </span>
    </div>
  );
}
