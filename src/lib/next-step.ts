/**
 * Where the "Start here" button takes the learner, so a beginner never has to decide where to go.
 */
export interface NextStep {
  readonly href: string;
  /** The step's name, as the learner sees it. */
  readonly title: string;
  /** One short line of context under the title. */
  readonly detail: string;
}

/**
 * Case 1 (docs/plan/06-case-1-the-clean-copy.md). Its page is a placeholder until file 05 builds
 * the workspace and file 06 writes the case.
 */
export const FIRST_STEP: NextStep = {
  href: "/cases/case-01",
  title: "Open Case 1",
  detail: "Your first investigation",
};
