import type { ComponentType } from "react";
import type { BrowsedImage, EvidenceSet, SimState } from "@/sim/types";
import type { RunnableCase } from "./run/case-definition";
import type { CaseRunAction, CaseRunState } from "./run/case-run";

/**
 * The workspace's right-hand panes (docs/plan/05-workspace-ui.md §Workspace layout). Each pane is
 * one line here: its id, its tab label, and a `load` that imports its component on demand, so a
 * pane's code arrives only when its tab first opens. Files 09 (timeline) and 10 (case board) each
 * add one line and nothing else; until then their tabs show an "arrives in a later update" state.
 *
 * The tabs always show in PANE_ORDER. A pane module's default export takes WorkspacePaneProps.
 */

export type PaneId = "evidence" | "timeline" | "board" | "objectives";

/** Tab order, left to right. */
export const PANE_ORDER: readonly PaneId[] = ["evidence", "timeline", "board", "objectives"];

/** What every pane gets. */
export interface WorkspacePaneProps {
  readonly caseDef: RunnableCase;
  readonly run: CaseRunState;
  readonly dispatch: (action: CaseRunAction) => void;
  /** The case's evidence as it was handed over, or null for a case with none yet. */
  readonly evidence: EvidenceSet | null;
  /** The analyst workstation the terminal runs on. */
  readonly workstation: PaneWorkstation;
  /**
   * The latest request, from another pane, to bring an artefact into view here ("Show in Evidence
   * Browser" on a board card). A new request has a new `id`.
   */
  readonly reveal?: PaneReveal;
}

/** A request to show one artefact in a pane. */
export interface PaneReveal {
  readonly ref: string;
  /** Goes up with every request, so asking twice for the same ref still counts. */
  readonly id: number;
}

/**
 * The analyst workstation, as a pane sees it. A pane never has its own read path: whatever it
 * shows of the evidence comes from the engine's state or through `browse`, so the write-blockers
 * apply to it exactly as they do to the terminal.
 */
export interface PaneWorkstation {
  /** The engine's latest state. Read it; change it only through `browse`. */
  readonly sim: SimState;
  /**
   * Opens a disk image through the engine, at its workstation path, the way the disk tools do:
   * an original through its write-blocker, or around it (changing it) when the blocker is off.
   * The open is kept in the run's log, so a save replays it. Undefined if nothing was there.
   */
  browse(path: string): BrowsedImage | undefined;
  /** Puts a command at the terminal's prompt without running it, and shows the terminal. */
  showInTerminal(line: string): void;
  /** Opens another pane's tab, asking it to bring `ref` into view when one is given. */
  show(pane: PaneId, ref?: string): void;
}

export interface WorkspacePane {
  readonly id: PaneId;
  readonly label: string;
  readonly load: () => Promise<{ default: ComponentType<WorkspacePaneProps> }>;
}

export const WORKSPACE_PANES: readonly WorkspacePane[] = [
  { id: "evidence", label: "Evidence", load: () => import("./components/evidence-pane") },
  { id: "objectives", label: "Objectives", load: () => import("./components/objectives-pane") },
  {
    id: "timeline",
    label: "Timeline",
    load: () => import("@/features/timeline").then((m) => ({ default: m.TimelinePane })),
  },
  {
    id: "board",
    label: "Board",
    load: () => import("@/features/case-board").then((m) => ({ default: m.CaseBoardPane })),
  },
];

/** Tab labels for panes that aren't registered yet. */
export const PANE_LABELS: Readonly<Record<PaneId, string>> = {
  evidence: "Evidence",
  timeline: "Timeline",
  board: "Board",
  objectives: "Objectives",
};
