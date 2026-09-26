import { describe, expect, it } from "vitest";
import { CHAPTER_ONE } from "@/content/cases/chapter";
import {
  CASE_ONE_STEPS,
  CHAPTER_LENGTH,
  DISCLAIMERS,
  EYEBROW,
  HACKER_SIMULATION_URL,
  LOOP_STEPS,
  PITCH,
  SIMULATED_LINE,
  START_NOTE,
  TITLE,
  stillBeingWritten,
} from "@/content/release";
import { HACKER_SIMULATION_LEARN_URL } from "@/content/references";
import { findBannedWords } from "@/content/voice";

describe("the landing page's promises", () => {
  it("follow the voice rules", () => {
    for (const line of [
      EYEBROW,
      TITLE,
      PITCH,
      START_NOTE,
      SIMULATED_LINE,
      CHAPTER_LENGTH,
      ...DISCLAIMERS,
      ...[...LOOP_STEPS, ...CASE_ONE_STEPS].flatMap(({ title, detail }) => [title, detail]),
      stillBeingWritten() ?? "",
    ]) {
      expect(findBannedWords(line), line).toEqual([]);
    }
  });

  it("show one SIMULATED marker: the line beside the badge doesn't say it again", () => {
    expect(SIMULATED_LINE).not.toMatch(/simulated/i);
  });

  it("walk through the loop in four steps and Case 1 in three", () => {
    expect(LOOP_STEPS.map(({ title }) => title)).toEqual([
      "Evidence",
      "Terminal",
      "Case board",
      "Report",
    ]);
    expect(CASE_ONE_STEPS).toHaveLength(3);
  });

  it("say which cases are still being written, from the chapter's flags", () => {
    const unreleased = CHAPTER_ONE.cases.filter((id) => CHAPTER_ONE.released[id] !== true);
    if (unreleased.length === 0) expect(stillBeingWritten()).toBeUndefined();
    else expect(stillBeingWritten()).toMatch(/still being written\.$/);
    // The "Case 1 only" release.
    if (unreleased.join() === "case-02,case-03") {
      expect(stillBeingWritten()).toBe("Cases 2 and 3 are still being written.");
    }
  });

  it("link the same Hacker Simulation the lessons do", () => {
    expect(HACKER_SIMULATION_LEARN_URL.startsWith(`${HACKER_SIMULATION_URL}/`)).toBe(true);
    // The chapter's closing points at Hacker Simulation's Chapter 2, on the same site.
    expect(CHAPTER_ONE.upNext.href.startsWith(`${HACKER_SIMULATION_URL}/`)).toBe(true);
  });

  it("release the whole chapter (prompt 15B.1), so nothing is still being written", () => {
    expect(CHAPTER_ONE.cases.every((id) => CHAPTER_ONE.released[id] === true)).toBe(true);
    expect(stillBeingWritten()).toBeUndefined();
  });
});
