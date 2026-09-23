import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRng, hashHex, isHashAlgorithm, md5, sha1, sha256, toHex } from "@/sim";
import type { HashAlgorithm } from "@/sim";

/**
 * The engine's hashes are written out in TypeScript, because `src/sim` runs in the browser too
 * (eslint.config.mjs bans `node:crypto` and the Web Crypto global there). A test is not the engine,
 * so this file may import `node:crypto` — and does, to prove the two agree byte for byte.
 */
const utf8 = (text: string) => new TextEncoder().encode(text);

const nodeHash = (algorithm: string, bytes: Uint8Array) =>
  createHash(algorithm).update(bytes).digest("hex");

describe("published test vectors", () => {
  // RFC 1321 §A.5.
  it.each([
    ["", "d41d8cd98f00b204e9800998ecf8427e"],
    ["a", "0cc175b9c0f1b6a831c399e269772661"],
    ["abc", "900150983cd24fb0d6963f7d28e17f72"],
    ["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
    ["abcdefghijklmnopqrstuvwxyz", "c3fcd3d76192e4007dfb496cca67e13b"],
    [
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      "d174ab98d277d9f5a5611c2c9f419d9f",
    ],
    [
      "12345678901234567890123456789012345678901234567890123456789012345678901234567890",
      "57edf4a22be3c955ac49da2e2107b67a",
    ],
  ])("md5(%j)", (text, expected) => {
    expect(toHex(md5(utf8(text)))).toBe(expected);
  });

  // FIPS 180-4 examples.
  it.each([
    ["abc", "a9993e364706816aba3e25717850c26c9cd0d89d"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "84983e441c3bd26ebaae4aa1f95129e5e54670f1",
    ],
  ])("sha1(%j)", (text, expected) => {
    expect(toHex(sha1(utf8(text)))).toBe(expected);
  });

  it.each([
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
  ])("sha256(%j)", (text, expected) => {
    expect(toHex(sha256(utf8(text)))).toBe(expected);
  });

  it("hashes a million 'a's like FIPS 180-4 does", () => {
    const million = new Uint8Array(1_000_000).fill(0x61);
    expect(toHex(sha1(million))).toBe("34aa973cd4c4daa4f61eeb2bdbad27316534016f");
    expect(toHex(sha256(million))).toBe(
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
    );
    expect(toHex(md5(million))).toBe("7707d6ae4e027c70eea2a935c2296f21");
  });
});

describe.each(["md5", "sha1", "sha256"] as const)("%s matches node:crypto", (algorithm) => {
  it("on 200 seeded random inputs from 0 bytes to 64 KB", () => {
    const rng = createRng(0x5eed);
    for (let i = 0; i < 200; i++) {
      // Lengths cluster around the interesting sizes (block and padding boundaries) and then
      // spread out to 64 KB, so multi-block hashing is exercised too.
      const length = i < 70 ? i : rng.int(0, 64 * 1024);
      const bytes = new Uint8Array(length);
      for (let b = 0; b < length; b++) bytes[b] = rng.int(0, 255);
      expect(hashHex(algorithm, bytes), `${algorithm} of ${length} bytes`).toBe(
        nodeHash(algorithm, bytes),
      );
    }
  });

  it("on the block-boundary lengths padding gets wrong", () => {
    for (const length of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129]) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 31) % 256);
      expect(hashHex(algorithm, bytes), `${length} bytes`).toBe(nodeHash(algorithm, bytes));
    }
  });
});

describe("hashHex", () => {
  it("names every algorithm the engine offers, and nothing else", () => {
    expect(isHashAlgorithm("sha256")).toBe(true);
    expect(isHashAlgorithm("sha512")).toBe(false);
    expect(isHashAlgorithm("toString")).toBe(false);
  });

  it("returns lowercase hex of the right length", () => {
    const lengths: Record<HashAlgorithm, number> = { md5: 32, sha1: 40, sha256: 64 };
    for (const [algorithm, length] of Object.entries(lengths) as [HashAlgorithm, number][]) {
      const hex = hashHex(algorithm, utf8("Quillfen Freight"));
      expect(hex).toMatch(/^[0-9a-f]+$/);
      expect(hex).toHaveLength(length);
    }
  });
});

describe("speed", () => {
  // The player hashes an image and waits for the answer, so this has to be fast enough not to
  // freeze the terminal: 02 §Pure hashes asks for 256 KB in under 50 ms. All three take a couple
  // of milliseconds, so the budget holds even with every test file running at once. Coverage
  // instrumentation slows everything down several times over, so it is skipped under
  // `pnpm test:coverage` (vitest.config.mts sets COVERAGE).
  it.skipIf(process.env.COVERAGE === "1").each(["md5", "sha1", "sha256"] as const)(
    "%s hashes 256 KB in under 50 ms",
    (algorithm) => {
      const bytes = Uint8Array.from({ length: 256 * 1024 }, (_, i) => (i * 7) % 256);
      hashHex(algorithm, bytes.subarray(0, 4096)); // warm up: don't charge it for compiling
      const started = performance.now();
      hashHex(algorithm, bytes);
      expect(performance.now() - started).toBeLessThan(50);
    },
  );
});
