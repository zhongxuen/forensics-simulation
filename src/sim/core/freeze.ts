/**
 * In development and tests, every state the engine hands out is deep-frozen, so code outside the
 * engine can't quietly mutate it. Production skips freezing to save the work.
 *
 * `process.env.NODE_ENV` is replaced with a literal at build time by Next.js, so this reads no
 * environment at runtime in the browser.
 */
const FREEZE = process.env.NODE_ENV !== "production";

/**
 * Freezes `value` and everything reachable from it. Already-frozen objects are skipped, which is
 * what keeps this cheap: with structural sharing, only the parts a command changed are new.
 */
export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

export function freezeInDev<T>(value: T): T {
  return FREEZE ? deepFreeze(value) : value;
}
