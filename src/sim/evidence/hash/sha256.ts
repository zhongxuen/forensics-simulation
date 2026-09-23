import { padMessage } from "./common";

/**
 * SHA-256 (FIPS 180-4), over bytes, returning the 32-byte digest. This is the hash the cases care
 * about: the SHA-256 on the handover form is what proves an image hasn't changed since it was
 * taken, so every image the player hashes goes through here.
 *
 * The constants are the first 32 bits of the fractional parts of the cube roots (K) and the square
 * roots (the initial state) of the first primes, written out rather than computed, so no rounding
 * difference between JavaScript engines can move them.
 *
 * Everything inside the loop is signed 32-bit (`| 0`, `Int32Array`), never `>>> 0`: an unsigned
 * word above 2^31 stops being a small integer, and the arithmetic slows by several times. The
 * digest is written out with `setUint32`, which takes the signed words back to bytes.
 */
const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL = new Int32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

export function sha256(bytes: Uint8Array): Uint8Array {
  const message = padMessage(bytes, false);
  const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
  const schedule = new Int32Array(64);
  const state = new Int32Array(INITIAL);

  for (let at = 0; at < message.length; at += 64) {
    for (let i = 0; i < 16; i++) schedule[i] = view.getInt32(at + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = schedule[i - 15] ?? 0;
      const y = schedule[i - 2] ?? 0;
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      schedule[i] = ((schedule[i - 16] ?? 0) + s0 + (schedule[i - 7] ?? 0) + s1) | 0;
    }

    let a = state[0] ?? 0;
    let b = state[1] ?? 0;
    let c = state[2] ?? 0;
    let d = state[3] ?? 0;
    let e = state[4] ?? 0;
    let f = state[5] ?? 0;
    let g = state[6] ?? 0;
    let h = state[7] ?? 0;

    for (let i = 0; i < 64; i++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const choose = (e & f) ^ (~e & g);
      const first = (h + s1 + choose + (K[i] ?? 0) + (schedule[i] ?? 0)) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const majority = (a & b) ^ (a & c) ^ (b & c);
      h = g;
      g = f;
      f = e;
      e = (d + first) | 0;
      d = c;
      c = b;
      b = a;
      a = (first + s0 + majority) | 0;
    }

    state[0] = ((state[0] ?? 0) + a) | 0;
    state[1] = ((state[1] ?? 0) + b) | 0;
    state[2] = ((state[2] ?? 0) + c) | 0;
    state[3] = ((state[3] ?? 0) + d) | 0;
    state[4] = ((state[4] ?? 0) + e) | 0;
    state[5] = ((state[5] ?? 0) + f) | 0;
    state[6] = ((state[6] ?? 0) + g) | 0;
    state[7] = ((state[7] ?? 0) + h) | 0;
  }

  const digest = new Uint8Array(32);
  const out = new DataView(digest.buffer);
  for (let i = 0; i < 8; i++) out.setUint32(i * 4, state[i] ?? 0);
  return digest;
}
