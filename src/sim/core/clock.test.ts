import { describe, expect, it } from "vitest";
import { fixedClock, formatInstant, parseInstant, steppingClock } from "./clock";

describe("clocks", () => {
  it("fixedClock always returns the same time", () => {
    const clock = fixedClock(1_000);
    expect([clock.now(), clock.now(), clock.now()]).toEqual([1_000, 1_000, 1_000]);
  });

  it("steppingClock starts at its start time and moves one step per call", () => {
    const clock = steppingClock(5_000, 250);
    expect([clock.now(), clock.now(), clock.now()]).toEqual([5_000, 5_250, 5_500]);
  });

  it("works when `now` is passed around on its own", () => {
    const { now } = steppingClock(0, 1);
    expect([now(), now()]).toEqual([0, 1]);
  });

  it("rejects times that aren't finite", () => {
    expect(() => fixedClock(Number.NaN)).toThrow(RangeError);
    expect(() => steppingClock(0, -1)).toThrow(RangeError);
  });
});

describe("parseInstant / formatInstant", () => {
  it("round-trips ISO-8601 UTC times", () => {
    const ms = parseInstant("2026-03-02T09:00:00Z");
    expect(ms).toBe(Date.UTC(2026, 2, 2, 9, 0, 0));
    expect(formatInstant(ms as number)).toBe("2026-03-02T09:00:00Z");
  });

  it("accepts explicit offsets", () => {
    expect(parseInstant("2026-03-02T10:00:00+01:00")).toBe(Date.UTC(2026, 2, 2, 9, 0, 0));
  });

  it("rejects times without a zone, so the machine's time zone never matters", () => {
    expect(parseInstant("2026-03-02T09:00:00")).toBeUndefined();
    expect(parseInstant("2026-03-02")).toBeUndefined();
    expect(parseInstant("not a date")).toBeUndefined();
  });
});
