import { toHex } from "./common";
import { md5 } from "./md5";
import { sha1 } from "./sha1";
import { sha256 } from "./sha256";

/**
 * Pure hashes (docs/plan/02-evidence-model.md §Pure hashes). `src/sim` runs in the browser as well
 * as in Node, so it can use neither `node:crypto` nor Web Crypto (which is asynchronous anyway);
 * these are written out in TypeScript and checked against `node:crypto` in
 * tests/unit/evidence-hash.test.ts.
 *
 * Hashes are always taken of `imageBytes(disk)` (image.ts), never of an object or of JSON, so the
 * game, the generator and the tests always agree on what was hashed.
 */
export { toHex } from "./common";
export { md5 } from "./md5";
export { sha1 } from "./sha1";
export { sha256 } from "./sha256";

export const HASH_ALGORITHMS = ["md5", "sha1", "sha256"] as const;
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

const DIGESTS: Record<HashAlgorithm, (bytes: Uint8Array) => Uint8Array> = { md5, sha1, sha256 };

export function isHashAlgorithm(name: string): name is HashAlgorithm {
  return Object.hasOwn(DIGESTS, name);
}

/** The digest of `bytes` as lowercase hex: 32 characters for MD5, 40 for SHA-1, 64 for SHA-256. */
export function hashHex(algorithm: HashAlgorithm, bytes: Uint8Array): string {
  return toHex(DIGESTS[algorithm](bytes));
}
