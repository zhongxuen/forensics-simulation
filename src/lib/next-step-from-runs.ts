import type { CaseRunSave } from "@/lib/case-storage";
import { FIRST_CASE_ID } from "@/content/cases/chapter";
import { FIRST_STEP, type NextStep } from "./next-step";

// Apart from next-step.ts, which every error page imports for FIRST_STEP: only the pages that
// read saved runs (the app shell, the case list) download this.

/** What the next step needs to know about one released chapter case. */
export interface NextStepCase {
  readonly id: string;
  /** Its number in the chapter: Case 1, Case 2… */
  readonly number: number;
  readonly title: string;
  /** Its main objectives' ids (not bonus or hidden ones): what "1 of 5" counts. */
  readonly objectives: readonly string[];
}

/** Where the sidebar goes once every case in the chapter is closed. */
const SANDBOX_STEP: NextStep = {
  href: "/sandbox",
  label: "Chapter closed",
  title: "Try the sandbox",
  detail: "Every tool on a practice drive, with no goals",
};

/**
 * The next step, from the runs saved in this browser (src/lib/case-storage) and the chapter's
 * released cases in order:
 *
 * 1. A case in progress (the one saved most recently, if there are several): "Continue Case 1 ·
 *    1 of 5".
 * 2. Otherwise the first case with no saved run: "Open Case 2" once Case 1 is closed.
 * 3. Otherwise, with every case closed, the sandbox.
 *
 * With nothing saved, or before the page can read storage, it's FIRST_STEP.
 */
export function nextStepFor(
  runs: Readonly<Record<string, CaseRunSave>>,
  cases: readonly NextStepCase[],
): NextStep {
  const saved = (id: string) => (Object.hasOwn(runs, id) ? runs[id] : undefined);

  const inProgress = cases
    .map((entry) => ({ entry, run: saved(entry.id) }))
    .filter(({ run }) => run !== undefined && run.phase !== "debrief")
    .sort((a, b) => (b.run?.savedAt ?? 0) - (a.run?.savedAt ?? 0))[0];
  if (inProgress?.run) {
    const { entry, run } = inProgress;
    const done = entry.objectives.filter((id) => run.completed.includes(id)).length;
    return {
      href: `/cases/${entry.id}`,
      label: "Pick up where you left off",
      title: `Continue Case ${entry.number} · ${done} of ${entry.objectives.length}`,
      detail: entry.title,
    };
  }

  const unplayed = cases.find((entry) => saved(entry.id) === undefined);
  if (unplayed === undefined) return cases.length > 0 ? SANDBOX_STEP : FIRST_STEP;
  if (unplayed.id === FIRST_CASE_ID) return FIRST_STEP;
  return {
    href: `/cases/${unplayed.id}`,
    label: "Up next",
    title: `Open Case ${unplayed.number}`,
    detail: unplayed.title,
  };
}
