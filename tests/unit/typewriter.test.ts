import { describe, expect, it } from "vitest";
import {
  charactersRevealed,
  TYPEWRITER_CHAR_MS,
  TYPEWRITER_MAX_MS,
  typewriterDurationMs,
} from "@/lib/typewriter";

describe("typewriterDurationMs", () => {
  it("types short lines at a steady pace", () => {
    expect(typewriterDurationMs(10)).toBe(10 * TYPEWRITER_CHAR_MS);
  });

  it("never takes longer than 1.5 seconds, however long the message", () => {
    expect(TYPEWRITER_MAX_MS).toBeLessThanOrEqual(1500);
    expect(typewriterDurationMs(5000)).toBe(TYPEWRITER_MAX_MS);
  });

  it("takes no time for an empty message", () => {
    expect(typewriterDurationMs(0)).toBe(0);
    expect(typewriterDurationMs(-3)).toBe(0);
    expect(typewriterDurationMs(Number.NaN)).toBe(0);
  });
});

describe("charactersRevealed", () => {
  it("starts with nothing shown", () => {
    expect(charactersRevealed(0, 40)).toBe(0);
    expect(charactersRevealed(-100, 40)).toBe(0);
  });

  it("reveals characters in proportion to the time elapsed", () => {
    const duration = typewriterDurationMs(40);
    expect(charactersRevealed(duration / 2, 40)).toBe(20);
  });

  it("shows the whole message once the time is up", () => {
    expect(charactersRevealed(typewriterDurationMs(40), 40)).toBe(40);
    expect(charactersRevealed(60_000, 40)).toBe(40);
  });

  it("finishes a long message within the cap", () => {
    expect(charactersRevealed(TYPEWRITER_MAX_MS, 900)).toBe(900);
  });

  it("never goes backwards", () => {
    let previous = 0;
    for (let elapsed = 0; elapsed <= 1600; elapsed += 16) {
      const shown = charactersRevealed(elapsed, 123);
      expect(shown).toBeGreaterThanOrEqual(previous);
      previous = shown;
    }
  });
});
