import { describe, expect, it } from "vitest";
import { progressFraction } from "@/lib/progress";

describe("progressFraction", () => {
  it("is value out of max", () => {
    expect(progressFraction(0, 4)).toBe(0);
    expect(progressFraction(1, 4)).toBe(0.25);
    expect(progressFraction(4, 4)).toBe(1);
  });

  it("clamps to 0–1", () => {
    expect(progressFraction(5, 4)).toBe(1);
    expect(progressFraction(-1, 4)).toBe(0);
  });

  it("reads a missing or broken total as not started", () => {
    expect(progressFraction(2, 0)).toBe(0);
    expect(progressFraction(2, -3)).toBe(0);
    expect(progressFraction(Number.NaN, 4)).toBe(0);
    expect(progressFraction(2, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
