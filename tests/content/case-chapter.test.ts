import { describe, expect, it } from "vitest";
import { CHAPTERS, CHAPTER_ONE, FIRST_CASE_ID, caseOrder } from "@/content/cases/chapter";
import { findBannedWords } from "@/content/voice";
import { CASE_LISTINGS } from "@/features/cases";
import { FIRST_STEP } from "@/lib/next-step";
import { catalog } from "./support";

/**
 * The chapter (`src/content/cases/chapter.ts`) is the one place that says which cases there are
 * and what order they come in, and several screens read it: the landing page's button, the app
 * shell's "Start here", and the case list. Nothing else checks that its ids are real cases, so
 * this does — a chapter naming a case that doesn't exist would send a first-time visitor to a 404.
 */
describe("the chapter", () => {
  // A chapter names its cases before they are written: case-02 and case-03 are in the chapter and
  // on the case list, and their pages say they arrive in a later update. What must never happen is
  // a chapter naming something with no page at all, which would be a 404 from the landing page.
  it("names only cases that have a page", () => {
    const slugs = CASE_LISTINGS.map((listing) => listing.slug);
    for (const id of CHAPTER_ONE.cases) {
      expect(slugs, `the chapter lists "${id}", which has no page`).toContain(id);
    }
  });

  it("leaves no written case out", () => {
    for (const entry of catalog.cases) {
      expect(CHAPTER_ONE.cases, `${entry.id} is a case but is in no chapter`).toContain(entry.id);
    }
  });

  it("lists each case once", () => {
    expect(new Set(CHAPTER_ONE.cases).size).toBe(CHAPTER_ONE.cases.length);
  });

  it("follows the voice rules", () => {
    for (const line of [
      CHAPTER_ONE.title,
      CHAPTER_ONE.client,
      CHAPTER_ONE.opening,
      CHAPTER_ONE.closing,
    ]) {
      expect(findBannedWords(line), line).toEqual([]);
    }
  });

  it("has one chapter in v1, and starts at its first case", () => {
    expect(CHAPTERS).toEqual([CHAPTER_ONE]);
    expect(FIRST_CASE_ID).toBe(CHAPTER_ONE.cases[0]);
    expect(FIRST_STEP.href).toBe(`/cases/${FIRST_CASE_ID}`);
  });

  it("orders the case list by the chapter, with anything outside it after", () => {
    const inChapter = CASE_LISTINGS.filter((listing) => CHAPTER_ONE.cases.includes(listing.slug));
    expect(inChapter.map((listing) => listing.slug)).toEqual([...CHAPTER_ONE.cases]);

    const keys = CASE_LISTINGS.map((listing) => caseOrder(listing.slug));
    expect(keys, "the listings are not in chapter order").toEqual([...keys].sort((a, b) => a - b));
    expect(Number.isFinite(caseOrder("not-a-case"))).toBe(true);
  });

  it("starts at a case that is written", () => {
    expect(catalog.getCase(FIRST_CASE_ID), `${FIRST_CASE_ID} is not a case`).toBeDefined();
  });

  // The badge on the case list and the line on a case's own page come from `status`, so a case
  // whose file exists must not still be advertised as unwritten, and the other way round.
  it("tells the truth about how far along each case is", () => {
    for (const listing of CASE_LISTINGS) {
      const written = catalog.getCase(listing.slug) !== undefined;
      if (listing.status === "planned") {
        expect(written, `${listing.slug} is written but listed as planned`).toBe(false);
      } else if (listing.status === "written") {
        expect(written, `${listing.slug} is listed as written but has no case file`).toBe(true);
        expect(
          listing.caseDef,
          `${listing.slug} is playable, so it isn't "written"`,
        ).toBeUndefined();
      } else {
        expect(
          listing.caseDef,
          `${listing.slug} is listed as playable with nothing to play`,
        ).toBeDefined();
      }
    }
  });
});
