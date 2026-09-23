/**
 * The case feature's public API, safe in the browser. Everything that reads a file or runs the
 * generator lives in `./server`, which client code must never import.
 */
export type {
  CaseBeat,
  CaseBriefing,
  CaseClient,
  CaseLine,
  CaseObjective,
  ObjectiveCheck,
  RunnableCase,
} from "./run/case-definition";
export {
  caseRunReducer,
  createCaseRun,
  currentObjective,
  toSave,
  visibleObjectives,
  type CasePhase,
  type CaseRunAction,
  type CaseRunReducerOptions,
  type CaseRunState,
  type StoryEntry,
} from "./run/case-run";
export {
  caseProgress,
  evaluateObjectives,
  eventMatches,
  isCaseComplete,
  mainObjectives,
  type ObjectiveEvaluator,
} from "./run/evaluate";
export {
  CASE_LISTINGS,
  CHAPTER,
  findCaseListing,
  type CaseListing,
  type CaseStatus,
} from "./run/catalog";
export { hasCaseEvidence, loadCaseEvidence } from "./run/evidence";
export { PRACTICE_CASE } from "./run/practice-case";
export { replayLog } from "./run/replay";
export { useCaseRun, type CaseRun, type UseCaseRunOptions } from "./run/use-case-run";
export { CaseList } from "./components/case-list";
export { CaseRunner } from "./components/case-runner";
export {
  PANE_LABELS,
  PANE_ORDER,
  WORKSPACE_PANES,
  type PaneId,
  type WorkspacePane,
  type WorkspacePaneProps,
} from "./workspace-panes";

// The generated evidence and the answer key, each fetched as its own chunk (file 03).
export {
  EvidenceNotBuiltError,
  loadEvidence,
  loadReportAnswers,
  type ReportAnswer,
  type ReportAnswers,
} from "./loader/evidence";
