import type { ComponentType } from "react";
import type { EvidenceSet } from "@/sim/types";
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
  /** The case's evidence: undefined while it loads, null for a case with none yet. */
  readonly evidence: EvidenceSet | null | undefined;
}

export interface WorkspacePane {
  readonly id: PaneId;
  readonly label: string;
  readonly load: () => Promise<{ default: ComponentType<WorkspacePaneProps> }>;
}

export const WORKSPACE_PANES: readonly WorkspacePane[] = [
  { id: "evidence", label: "Evidence", load: () => import("./components/evidence-pane") },
  { id: "objectives", label: "Objectives", load: () => import("./components/objectives-pane") },
];

/** Tab labels for panes that aren't registered yet. */
export const PANE_LABELS: Readonly<Record<PaneId, string>> = {
  evidence: "Evidence",
  timeline: "Timeline",
  board: "Board",
  objectives: "Objectives",
};
