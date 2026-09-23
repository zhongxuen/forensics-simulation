/**
 * The pieces MD5, SHA-1 and SHA-256 share: hex output and Merkle-Damgård padding.
 *
 * These hashes are written out in TypeScript because `src/sim` runs in the browser as well as in
 * Node, where `node:crypto` doesn't exist and Web Crypto is asynchronous (eslint.config.mjs bans
 * both). Evidence hashing has to be synchronous and identical everywhere: the same image must give
 * the same hash in the game, in the generator and in a test.
 */

const HEX_BYTE = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

/** Lowercase hex, two characters per byte, the way every forensics tool prints a digest. */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += HEX_BYTE[bytes[i] ?? 0];
  return out;
}

/**
 * The message with the padding all three hashes use: a `0x80` byte, then zeros, then the message's
 * length in bits as 64 bits, filling whole 64-byte blocks. MD5 writes that length little-endian,
 * SHA-1 and SHA-256 big-endian.
 */
export function padMessage(bytes: Uint8Array, littleEndian: boolean): Uint8Array {
  const total = (((bytes.length + 8) >> 6) + 1) << 6;
  const out = new Uint8Array(total);
  out.set(bytes);
  out[bytes.length] = 0x80;
  // The length in bits as two 32-bit halves, so it stays exact past 512 MB.
  const low = (bytes.length * 8) >>> 0;
  const high = Math.floor(bytes.length / 0x2000_0000);
  const view = new DataView(out.buffer);
  view.setUint32(total - (littleEndian ? 8 : 4), low, littleEndian);
  view.setUint32(total - (littleEndian ? 4 : 8), high, littleEndian);
  return out;
}
