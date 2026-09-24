import { describe, expect, it } from "vitest";
import { CHAPTER_ONE } from "@/content/cases/chapter";
import {
  DISCLAIMERS,
  HACKER_SIMULATION_URL,
  PITCH,
  SIMULATED_LINE,
  stillBeingWritten,
} from "@/content/release";
import { HACKER_SIMULATION_LEARN_URL } from "@/content/references";
import { findBannedWords } from "@/content/voice";

describe("the landing page's promises", () => {
  it("follow the voice rules", () => {
    for (const line of [PITCH, SIMULATED_LINE, ...DISCLAIMERS, stillBeingWritten() ?? ""]) {
      expect(findBannedWords(line), line).toEqual([]);
    }
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
  });
});
