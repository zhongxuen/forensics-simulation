import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  CHAPTER_ONE,
  FIRST_CASE_ID,
  caseOrder,
  isReleased,
} from "@/content/cases/chapter";
import { findBannedWords } from "@/content/voice";
import { CASE_LISTINGS, hasCaseEvidence, RELEASED_CASE_LISTINGS } from "@/features/cases";
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

  // A case's evidence reaches the browser only through a line in run/evidence.ts. Without it the
  // workstation starts with nothing attached, and every tool says so.
  it("gives every playable chapter case its evidence in the browser", () => {
    for (const listing of CASE_LISTINGS) {
      if (!CHAPTER_ONE.cases.includes(listing.slug) || listing.status !== "playable") continue;
      expect(hasCaseEvidence(listing.slug), `${listing.slug} has no evidence loader`).toBe(true);
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
      CHAPTER_ONE.closing.text,
      CHAPTER_ONE.upNext.text,
      CHAPTER_ONE.upNext.label,
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
        // Playable is either a case in the runner's own shape, or a case file the page builds.
        expect(
          listing.caseDef !== undefined || written,
          `${listing.slug} is listed as playable with nothing to play`,
        ).toBe(true);
      }
    }
  });

  // Releasing a case is a flag, never a deletion: an unreleased case keeps its page (a link or a
  // save may point at it) and is only left off the list.
  it("has a released flag for every case, and releases the first", () => {
    expect(Object.keys(CHAPTER_ONE.released).sort()).toEqual([...CHAPTER_ONE.cases].sort());
    expect(isReleased(FIRST_CASE_ID)).toBe(true);
    expect(isReleased("not-a-case")).toBe(false);
  });

  it("lists only released cases, and keeps a page for every case", () => {
    const listed = RELEASED_CASE_LISTINGS.map((listing) => listing.slug);
    for (const id of CHAPTER_ONE.cases) {
      expect(listed.includes(id), id).toBe(isReleased(id));
      expect(
        CASE_LISTINGS.some((listing) => listing.slug === id),
        id,
      ).toBe(true);
    }
  });

  it("only releases a case that can be played", () => {
    for (const id of CHAPTER_ONE.cases.filter(isReleased)) {
      expect(CASE_LISTINGS.find((listing) => listing.slug === id)?.status, id).toBe("playable");
    }
  });
});
