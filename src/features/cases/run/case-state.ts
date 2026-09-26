import type { CaseRunSave } from "@/lib/case-storage";

// Kept apart from catalog.ts, which imports the practice case (and with it the engine): the case
// list reads these in the browser, and must not pull the terminal into /cases' first download.

/**
 * What the case list and the sidebar's next step show about a case without loading it: its number
 * in the chapter, how long it takes, and the main objectives a saved run is counted against. Built
 * on the server (the case files are read there) and handed to the browser, which adds the state
 * from the run saved in this browser.
 */
export interface CaseSummary {
  /** The id runs are saved under, which is also the slug in its address. */
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  /** Its number in the chapter. The practice case, outside the chapter, has none. */
  readonly number?: number;
  /** About how long it takes, from the case file. Undefined for a case not playable yet. */
  readonly minutes?: number;
  /** The main objectives' ids (not bonus or hidden ones): what "2 of 5" counts. */
  readonly objectives: readonly string[];
  /** Offered to players yet (`released` in the chapter). The practice case always is. */
  readonly released: boolean;
}

/** The parts of a case a summary reads: a case file (`getCase` on the server) or a RunnableCase. */
export interface SummarySource {
  readonly estimatedMinutes: number;
  readonly objectives: readonly {
    readonly id: string;
    readonly optional?: boolean;
    readonly hidden?: boolean;
  }[];
}

/**
 * Where the player is in a case, from the run saved in this browser: not started, in progress
 * (main objectives ticked, of how many), or closed (the report's findings supported at its latest
 * submission, when the save recorded one).
 */
export type CaseState =
  | { readonly kind: "not-started" }
  | { readonly kind: "in-progress"; readonly done: number; readonly total: number }
  | { readonly kind: "closed"; readonly supported?: number; readonly total?: number };

export function caseState(summary: CaseSummary, run: CaseRunSave | undefined): CaseState {
  if (run === undefined) return { kind: "not-started" };
  if (run.phase === "debrief") {
    const submitted = run.marks.findLast((mark) => mark.kind === "submitted");
    return submitted?.kind === "submitted"
      ? { kind: "closed", supported: submitted.supported, total: submitted.total }
      : { kind: "closed" };
  }
  return {
    kind: "in-progress",
    done: summary.objectives.filter((id) => run.completed.includes(id)).length,
    total: summary.objectives.length,
  };
}
