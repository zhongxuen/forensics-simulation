import { padMessage } from "./common";

/**
 * SHA-1 (FIPS 180-4), over bytes, returning the 20-byte digest.
 *
 * Like MD5 it is no longer collision-resistant, and like MD5 it still turns up on evidence forms
 * and in older tools' output, so the game can print it and say why it isn't relied on alone.
 *
 * As in sha256.ts, the working words stay signed 32-bit (`| 0`, `Int32Array`) rather than unsigned,
 * because a word above 2^31 stops being a small integer and the arithmetic slows down several
 * times over.
 */
export function sha1(bytes: Uint8Array): Uint8Array {
  const message = padMessage(bytes, false);
  const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
  const schedule = new Int32Array(80);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89 | 0;
  let h2 = 0x98badcfe | 0;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0 | 0;

  for (let at = 0; at < message.length; at += 64) {
    for (let i = 0; i < 16; i++) schedule[i] = view.getInt32(at + i * 4);
    for (let i = 16; i < 80; i++) {
      const mixed =
        (schedule[i - 3] ?? 0) ^
        (schedule[i - 8] ?? 0) ^
        (schedule[i - 14] ?? 0) ^
        (schedule[i - 16] ?? 0);
      schedule[i] = (mixed << 1) | (mixed >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i++) {
      let mixed: number;
      let k: number;
      if (i < 20) {
        mixed = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        mixed = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        mixed = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc | 0;
      } else {
        mixed = b ^ c ^ d;
        k = 0xca62c1d6 | 0;
      }
      const next = (((a << 5) | (a >>> 27)) + mixed + e + k + (schedule[i] ?? 0)) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = next;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const digest = new Uint8Array(20);
  const out = new DataView(digest.buffer);
  for (const [i, word] of [h0, h1, h2, h3, h4].entries()) out.setUint32(i * 4, word);
  return digest;
}
