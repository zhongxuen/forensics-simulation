import { CHAPTER_ONE, caseOrder } from "@/content/cases/chapter";
import type { RunnableCase } from "./case-definition";
import { PRACTICE_CASE } from "./practice-case";

/**
 * The cases in the list, until file 03's loader replaces this. The chapter
 * (`src/content/cases/chapter.ts`) decides their order, so a case moved there moves here too.
 * The practice case is not part of the chapter and sits after it. Every case is listed whatever
 * state it is in, and its own page says which; every case page is built ahead of time from this
 * list, so any other slug is a 404.
 */

/**
 * How far along a case is, which decides what its page shows:
 *
 * - `playable` — the workspace runs it end to end.
 * - `written` — the case, its story and its evidence exist and `pnpm case:play` finishes it, but
 *   the workspace can't yet: its objectives are checked by pinning evidence and answering a
 *   report, and the case board and the real report arrive with file 10.
 * - `planned` — nothing written yet.
 */
export type CaseStatus = "playable" | "written" | "planned";

export interface CaseListing {
  readonly slug: string;
  readonly title: string;
  /** One line under the title. */
  readonly summary: string;
  readonly status: CaseStatus;
  /** The case to play in the browser. Only a `playable` case has one. */
  readonly caseDef?: RunnableCase;
}

const LISTINGS: readonly CaseListing[] = [
  {
    slug: "case-01",
    title: "The clean copy",
    summary:
      "A laptop arrives in a sealed bag with a fingerprint on the form. Make a copy you can prove is the same drive.",
    status: "written",
  },
  {
    slug: "case-02",
    title: "The deleted invoice",
    summary: "An invoice vanished from a company laptop. Follow the evidence, not the suspicion.",
    status: "planned",
  },
  {
    slug: "case-03",
    title: "Something is still running",
    summary: "A server is behaving oddly, and whatever did it may still be in memory.",
    status: "planned",
  },
  {
    slug: PRACTICE_CASE.slug,
    title: PRACTICE_CASE.title,
    summary: PRACTICE_CASE.hook,
    status: "playable",
    caseDef: PRACTICE_CASE,
  },
];

export const CASE_LISTINGS: readonly CaseListing[] = [...LISTINGS].sort(
  (a, b) => caseOrder(a.slug) - caseOrder(b.slug),
);

/** The chapter these cases belong to, for the page that lists them. */
export const CHAPTER = CHAPTER_ONE;

/** The listing for a slug, or undefined. */
export function findCaseListing(slug: string): CaseListing | undefined {
  return CASE_LISTINGS.find((listing) => listing.slug === slug);
}
