/**
 * A small seeded pseudo-random number generator (mulberry32). The engine never uses
 * `Math.random()`: every "random" latency or timing comes from here, so the same seed always
 * produces the same numbers, in the same order.
 */
export interface Rng {
  /** The seed this generator started from, as an unsigned 32-bit integer. */
  readonly seed: number;
  /** The next unsigned 32-bit integer. */
  uint32(): number;
  /** The next float in [0, 1). */
  next(): number;
  /** The next integer in [min, max], inclusive at both ends. */
  int(min: number, max: number): number;
  /** One item from a non-empty list. */
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  const start = normalizeSeed(seed);
  let a = start | 0;

  const uint32 = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const next = (): number => uint32() / 0x1_0000_0000;

  return {
    seed: start,
    uint32,
    next,
    int(min, max) {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
        throw new RangeError(`rng.int needs integers with min <= max, got ${min} and ${max}`);
      }
      if (max - min + 1 > 0x1_0000_0000) {
        throw new RangeError("rng.int range is wider than 2^32");
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      if (items.length === 0) throw new RangeError("rng.pick needs a non-empty list");
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
  };
}

/** Any finite number becomes an unsigned 32-bit seed. */
export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) throw new RangeError(`seed must be a finite number, got ${seed}`);
  return Math.trunc(seed) >>> 0;
}

/** A stable seed from text, such as a scenario id (32-bit FNV-1a over UTF-16 code units). */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The seed for one command. Each step gets its own generator derived from the run's seed and the
 * command's position, so a restored snapshot continues exactly where the original left off.
 */
export function deriveSeed(seed: number, tick: number): number {
  let h = (normalizeSeed(seed) ^ Math.imul(tick + 1, 0x9e3779b1)) >>> 0;
  // murmur3's 32-bit finalizer: nearby ticks give unrelated seeds.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
