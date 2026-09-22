/**
 * Standard base64 (RFC 4648 §4, with padding), written out so the engine needs no `atob`/`Buffer`
 * and behaves the same in Node and the browser. Evidence stores bytes this way to stay plain JSON.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Map([...ALPHABET].map((char, i) => [char, i]));

/** Padded base64: whole 4-character groups, `=` only at the end. */
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function isBase64(text: string): boolean {
  return BASE64.test(text);
}

/** How many bytes `text` decodes to, without decoding it. */
export function base64ByteLength(text: string): number {
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  return (text.length / 4) * 3 - padding;
}

export function encodeBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += ALPHABET[(n >> 18) & 63];
    out += ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : "=";
  }
  return out;
}

/** Decodes padded base64. Throws a TypeError for anything else. */
export function decodeBase64(text: string): Uint8Array {
  if (!isBase64(text)) throw new TypeError("not padded base64");
  const out = new Uint8Array(base64ByteLength(text));
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const n =
      (value(text, i) << 18) |
      (value(text, i + 1) << 12) |
      (value(text, i + 2) << 6) |
      value(text, i + 3);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

function value(text: string, i: number): number {
  const char = text[i];
  return char === "=" || char === undefined ? 0 : (LOOKUP.get(char) ?? 0);
}
