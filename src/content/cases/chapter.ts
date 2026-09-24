/**
 * The chapter: the order the cases are played in, and the two lines that frame them
 * (docs/plan/06-case-1-the-clean-copy.md, step 4).
 *
 * v1 is one chapter of three cases at one client (docs/plan/00-overview.md §3). Everything that
 * needs to know "which case comes first" reads it from here rather than hard-coding `case-01`:
 * the landing page's button, the app shell's "Start here", and the case list's order.
 *
 * `cases` holds ids, not case files. A case's own content lives in `<id>.yaml` beside this file,
 * and `tests/content/case-chapter.test.ts` checks every id here is a case that exists, that no
 * case is left out of the chapter, and that the copy follows the voice rules.
 */

export interface Chapter {
  readonly id: string;
  readonly title: string;
  /** Where the chapter is set, for a line of context under the title. */
  readonly client: string;
  /** The line that opens the chapter, before any case: the landing page's promise. */
  readonly opening: string;
  /**
   * The line that closes it, once all three cases are done. The chapter debrief that shows it is
   * file 15's; until then it is here so the chapter is written down in one place.
   */
  readonly closing: string;
  /** Case ids, in the order they are meant to be played. */
  readonly cases: readonly string[];
  /**
   * Whether each case is offered to players yet: one flag per case in `cases`. An unreleased case
   * keeps its file, its evidence and its page (nothing is deleted); `/cases` leaves it off the
   * list and the landing page says it's still being written. Releasing one is flipping its flag.
   */
  readonly released: Readonly<Record<string, boolean>>;
}

export const CHAPTER_ONE: Chapter = {
  id: "chapter-01",
  title: "What happened at Quillfen",
  client: "Quillfen Freight, a small family haulage yard",
  opening:
    "A haulage yard came back on Monday to a laptop that had been awake all weekend. Over three cases you copy it without changing it, work out what went missing and when, and find out what is still running on their dispatch server.",
  closing:
    "Three cases, one yard, and a report at the end of each that points at evidence rather than at a person. That is the job: find out what happened, write down how you know, and say what would stop it happening again.",
  cases: ["case-01", "case-02", "case-03"],
  // The "Case 1 only" release (docs/plan/15-quality-and-launch.md, part A). Cases 2 and 3 are
  // released by prompt 15B.1, once files 11 and 12 have written them.
  released: { "case-01": true, "case-02": false, "case-03": false },
};

/** The chapter's first case: where a visitor with no account starts. */
export const FIRST_CASE_ID: string = CHAPTER_ONE.cases[0] as string;

/** Whether a chapter case is offered to players yet. A case the chapter doesn't list is not. */
export function isReleased(id: string): boolean {
  return Object.hasOwn(CHAPTER_ONE.released, id) && CHAPTER_ONE.released[id] === true;
}

/** Every chapter, in order. There is one in v1. */
export const CHAPTERS: readonly Chapter[] = [CHAPTER_ONE];

/**
 * Where a case sits in the chapter. A case the chapter doesn't list — the practice case — sorts
 * after every case that is in it, and two of those keep the order they were written in. The key
 * stays a finite number so subtracting two of them is always a number.
 */
export function caseOrder(id: string): number {
  const index = CHAPTER_ONE.cases.indexOf(id);
  return index === -1 ? CHAPTER_ONE.cases.length : index;
}
