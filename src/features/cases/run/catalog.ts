import type { RunnableCase } from "./case-definition";
import { PRACTICE_CASE } from "./practice-case";

/**
 * The cases in the list, in order, until file 03's loader replaces this. The three v1 cases are
 * listed with no content: their pages say they arrive in a later update. Every case page is built
 * ahead of time from this list, so any other slug is a 404.
 */
export interface CaseListing {
  readonly slug: string;
  readonly title: string;
  /** One line under the title. */
  readonly summary: string;
  /** The case to play, or undefined while it's still being written. */
  readonly caseDef?: RunnableCase;
}

export const CASE_LISTINGS: readonly CaseListing[] = [
  {
    slug: PRACTICE_CASE.slug,
    title: PRACTICE_CASE.title,
    summary: PRACTICE_CASE.hook,
    caseDef: PRACTICE_CASE,
  },
  {
    slug: "case-01",
    title: "The clean copy",
    summary: "Copy a laptop's disk without changing a single byte, and prove it.",
  },
  {
    slug: "case-02",
    title: "The deleted invoice",
    summary: "An invoice vanished from a company laptop. Follow the evidence, not the suspicion.",
  },
  {
    slug: "case-03",
    title: "Something is still running",
    summary: "A server is behaving oddly, and whatever did it may still be in memory.",
  },
];

/** The listing for a slug, or undefined. */
export function findCaseListing(slug: string): CaseListing | undefined {
  return CASE_LISTINGS.find((listing) => listing.slug === slug);
}
