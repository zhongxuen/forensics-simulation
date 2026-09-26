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

import type { CastId } from "../cast";

/** A cast member's line, in Hacker Simulation's chapter-closing format (`campaigns/main.ts`). */
export interface ChapterLine {
  readonly speaker: CastId;
  readonly text: string;
}

export interface Chapter {
  readonly id: string;
  readonly title: string;
  /** Where the chapter is set, for a line of context under the title. */
  readonly client: string;
  /** The line that opens the chapter, before any case: the landing page's promise. */
  readonly opening: string;
  /**
   * The line that closes it, shown on the debrief of the chapter's last case: Idris tying the
   * three cases together (docs/plan/12-case-3-something-is-still-running.md, §Chapter closing).
   */
  readonly closing: ChapterLine;
  /** Where the story goes next, under the closing line, with a link to follow it there. */
  readonly upNext: { readonly text: string; readonly href: string; readonly label: string };
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
  closing: {
    speaker: "teammate-idris",
    text: "One laptop left unlocked, one password on a note in a shared folder, one door left open to the internet, and the same two letters left behind each time: `— HL`. Nobody broke in at Quillfen. They found three doors open and walked through, and your three reports say which doors, and how to shut them.",
  },
  upNext: {
    text: "The Hollow Latch have been busy two streets over. Candlewright's red team met them first, at a theatre and a library, from the other side of the door.",
    href: "https://hacker-simulation.vercel.app/campaign#chapter-the-handover",
    label: "Play Chapter 2 of Hacker Simulation",
  },
  cases: ["case-01", "case-02", "case-03"],
  // Released by prompt 15B.1 (docs/plan/15-quality-and-launch.md, part B), after the "Case 1 only"
  // release of part A. Flip a flag back to take a case off the list without deleting anything.
  released: { "case-01": true, "case-02": true, "case-03": true },
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
