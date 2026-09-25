import { CHAPTER_ONE, caseOrder, isReleased } from "@/content/cases/chapter";
import type { RunnableCase } from "./case-definition";
import type { CaseSummary, SummarySource } from "./case-state";
import { PRACTICE_CASE } from "./practice-case";

/**
 * The cases in the list. The chapter (`src/content/cases/chapter.ts`) decides their order, so a
 * case moved there moves here too, and whether a case is released yet: `/cases` shows only
 * released ones. The practice case is not part of the chapter and sits after it. Every case page
 * is built ahead of time from this list, so any other slug is a 404.
 */

/**
 * How far along a case is, which decides what its page shows:
 *
 * - `playable` — the workspace runs it end to end. A listing with no `caseDef` is a case file,
 *   which the case page turns into one on the server (`getRunnableCase`).
 * - `written` — the case, its story and its evidence exist and `pnpm case:play` finishes it, but
 *   the workspace can't play it yet.
 * - `planned` — nothing written yet.
 */
export type CaseStatus = "playable" | "written" | "planned";

export interface CaseListing {
  readonly slug: string;
  readonly title: string;
  /** One line under the title. */
  readonly summary: string;
  readonly status: CaseStatus;
  /**
   * The case to play in the browser, for a case written in the runner's own shape (the practice
   * case). A playable case file has none here: its page builds it on the server.
   */
  readonly caseDef?: RunnableCase;
}

const LISTINGS: readonly CaseListing[] = [
  {
    slug: "case-01",
    title: "The clean copy",
    summary:
      "A laptop arrives in a sealed bag with a fingerprint on the form. Make a copy you can prove is the same drive.",
    status: "playable",
  },
  {
    slug: "case-02",
    title: "The deleted invoice",
    summary:
      "Three invoices vanished and everyone suspects the bookkeeper. Follow the evidence, not the suspicion.",
    status: "playable",
  },
  {
    slug: "case-03",
    title: "Something is still running",
    summary:
      "A server is talking to a stranger once a minute. Find out what is running, before anybody pulls the plug.",
    status: "playable",
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

/**
 * What `/cases` lists: the chapter's released cases, then anything outside the chapter. A case
 * that isn't released keeps its page (a link or a save may point at it), but isn't offered.
 */
export const RELEASED_CASE_LISTINGS: readonly CaseListing[] = CASE_LISTINGS.filter(
  (listing) => !CHAPTER_ONE.cases.includes(listing.slug) || isReleased(listing.slug),
);

/** The chapter these cases belong to, for the page that lists them. */
export const CHAPTER = CHAPTER_ONE;

/** The listing for a slug, or undefined. */
export function findCaseListing(slug: string): CaseListing | undefined {
  return CASE_LISTINGS.find((listing) => listing.slug === slug);
}

/**
 * A summary of every case in the list, in its order: the chapter's cases, released or not, then
 * the practice case. `getCase` reads a playable case's file (on the server, `getCase`, which
 * parses it without generating its evidence).
 */
export function caseSummaries(
  getCase: (slug: string) => SummarySource | undefined,
): readonly CaseSummary[] {
  return CASE_LISTINGS.map((listing) => {
    const caseDef: SummarySource | undefined =
      listing.caseDef ?? (listing.status === "playable" ? getCase(listing.slug) : undefined);
    const index = CHAPTER_ONE.cases.indexOf(listing.slug);
    return {
      id: listing.slug,
      title: listing.title,
      summary: listing.summary,
      ...(index === -1 ? {} : { number: index + 1 }),
      ...(caseDef ? { minutes: caseDef.estimatedMinutes } : {}),
      // Main objectives only, as `mainObjectives` counts them.
      objectives: (caseDef?.objectives ?? [])
        .filter((objective) => objective.optional !== true && objective.hidden !== true)
        .map((objective) => objective.id),
      released: index === -1 || isReleased(listing.slug),
    };
  });
}
