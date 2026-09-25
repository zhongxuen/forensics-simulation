/**
 * The case feature's public API, safe in the browser. Everything that reads a file or runs the
 * generator lives in `./server`, which client code must never import.
 */
export type {
  CaseBeat,
  CaseLesson,
  CaseBriefing,
  CaseClient,
  CaseDebriefSpec,
  CaseLine,
  CaseObjective,
  CaseReportQuestion,
  CaseReportSpec,
  ObjectiveCheck,
  RunnableCase,
} from "./run/case-definition";
export {
  gradeQuestion,
  gradeReport,
  isCorrect,
  parseAnswerTime,
  reportAnswers,
  supportedCount,
  type Finding,
  type FindingReason,
  type CitedAnswer,
  type GradableQuestion,
  type ReportVerdict,
} from "./grading";
export {
  CUSTODY_LABELS,
  custodyLog,
  custodyRuleHolds,
  custodyText,
  describeCustody,
  hashedBeforeAnalysing,
  isAnalysis,
  type CustodyEntry,
  type CustodyKind,
  type CustodyRecordHeader,
  type CustodyRule,
} from "./custody";
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
  type RunBoard,
} from "./run/evaluate";
export { objectiveSuggestions } from "./run/suggestions";
export {
  CASE_LISTINGS,
  CHAPTER,
  RELEASED_CASE_LISTINGS,
  caseSummaries,
  findCaseListing,
  type CaseListing,
  type CaseStatus,
} from "./run/catalog";
export { caseState, type CaseState, type CaseSummary, type SummarySource } from "./run/case-state";
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
  type PaneExplainRow,
  type PaneId,
  type PaneReveal,
  type PaneWorkstation,
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
