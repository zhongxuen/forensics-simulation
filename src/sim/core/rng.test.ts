import { describe, expect, it } from "vitest";
import { createRng, deriveSeed, normalizeSeed, seedFromString } from "./rng";

/** mulberry32 exactly as published, to prove createRng is the real algorithm. */
function referenceMulberry32(seed: number) {
  let a = seed;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const take = <T>(next: () => T, count: number): T[] => Array.from({ length: count }, () => next());

describe("createRng", () => {
  it("is reproducible: the same seed gives the same sequence", () => {
    expect(take(createRng(42).next, 1000)).toEqual(take(createRng(42).next, 1000));
  });

  it("matches the reference mulberry32 implementation", () => {
    for (const seed of [0, 1, 42, 123_456_789, 0xffffffff]) {
      expect(take(createRng(seed).next, 500)).toEqual(take(referenceMulberry32(seed), 500));
    }
  });

  it("gives different sequences for different seeds", () => {
    expect(take(createRng(1).next, 10)).not.toEqual(take(createRng(2).next, 10));
  });

  it("keeps next() in [0, 1)", () => {
    for (const value of take(createRng(7).next, 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("keeps int(min, max) inside the inclusive range and reaches both ends", () => {
    const rng = createRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const value = rng.int(3, 7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
    expect(rng.int(5, 5)).toBe(5);
  });

  it("rejects impossible int ranges", () => {
    const rng = createRng(1);
    expect(() => rng.int(5, 4)).toThrow(RangeError);
    expect(() => rng.int(0.5, 4)).toThrow(RangeError);
  });

  it("picks from a list, reproducibly, and refuses an empty one", () => {
    const items = ["a", "b", "c", "d"] as const;
    const picks = (seed: number) => {
      const rng = createRng(seed);
      return take(() => rng.pick(items), 50);
    };
    expect(picks(5)).toEqual(picks(5));
    expect(new Set(picks(5)).size).toBeGreaterThan(1);
    expect(() => createRng(1).pick([])).toThrow(RangeError);
  });

  it("normalizes seeds to unsigned 32-bit integers", () => {
    expect(createRng(-1).seed).toBe(0xffffffff);
    expect(createRng(2 ** 32 + 5).seed).toBe(5);
    expect(createRng(3.9).seed).toBe(3);
    expect(() => normalizeSeed(Number.NaN)).toThrow(RangeError);
  });
});

describe("seed helpers", () => {
  it("derives a stable, distinct seed per tick", () => {
    expect(deriveSeed(42, 1)).toBe(deriveSeed(42, 1));
    const perTick = new Set(Array.from({ length: 100 }, (_, tick) => deriveSeed(42, tick)));
    expect(perTick.size).toBe(100);
    expect(deriveSeed(42, 1)).not.toBe(deriveSeed(43, 1));
  });

  it("hashes text to a stable seed", () => {
    expect(seedFromString("intro-01")).toBe(seedFromString("intro-01"));
    expect(seedFromString("intro-01")).not.toBe(seedFromString("intro-02"));
    expect(seedFromString("")).toBe(0x811c9dc5);
  });
});
