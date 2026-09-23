import { CHAPTER_ONE, FIRST_CASE_ID } from "@/content/cases/chapter";

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
 * The chapter's first case (`src/content/cases/chapter.ts`). The chapter decides which one that
 * is, so reordering the cases there moves every "Start here" in the app with it.
 */
export const FIRST_STEP: NextStep = {
  href: `/cases/${FIRST_CASE_ID}`,
  title: "Open Case 1",
  detail: `Your first investigation, at ${CHAPTER_ONE.client.split(",")[0]}`,
};
