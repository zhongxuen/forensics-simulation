/**
 * Turning values into bytes, without `TextEncoder` or `Buffer`, for the same reason base64.ts is
 * written out: the engine must produce identical bytes in Node and in the browser, and hashes are
 * taken of those bytes.
 */

/** UTF-8 encodes `text`. Unpaired surrogates become U+FFFD, as `TextEncoder` does. */
export function utf8Bytes(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i++;
      } else {
        code = 0xfffd;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;
    }

    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(out);
}

/**
 * A growing buffer of little-endian fields, used to lay out a disk image (image.ts). Every method
 * appends; `done()` returns exactly the bytes written.
 */
export class ByteWriter {
  // TypeScript-private, not `#private`: the target is ES2017, where `#` fields are downlevelled
  // into WeakMap lookups, and this runs once per byte written.
  private buffer: Uint8Array;
  private written = 0;

  constructor(capacity = 1024) {
    this.buffer = new Uint8Array(Math.max(capacity, 16));
  }

  /** How many bytes have been written so far. */
  get length(): number {
    return this.written;
  }

  u8(value: number): this {
    this.room(1);
    this.buffer[this.written++] = value & 0xff;
    return this;
  }

  u32(value: number): this {
    this.room(4);
    new DataView(this.buffer.buffer).setUint32(this.written, value >>> 0, true);
    this.written += 4;
    return this;
  }

  /** A number as an IEEE 754 double: exact for every integer an `Instant` can hold. */
  f64(value: number): this {
    this.room(8);
    new DataView(this.buffer.buffer).setFloat64(this.written, value, true);
    this.written += 8;
    return this;
  }

  bytes(value: Uint8Array): this {
    this.room(value.length);
    this.buffer.set(value, this.written);
    this.written += value.length;
    return this;
  }

  /** UTF-8 text, preceded by its byte length, so the layout can be read back unambiguously. */
  text(value: string): this {
    const encoded = utf8Bytes(value);
    return this.u32(encoded.length).bytes(encoded);
  }

  zeros(count: number): this {
    this.room(count);
    this.written += count;
    return this;
  }

  done(): Uint8Array {
    return this.buffer.slice(0, this.written);
  }

  private room(extra: number): void {
    if (this.written + extra <= this.buffer.length) return;
    let capacity = this.buffer.length * 2;
    while (capacity < this.written + extra) capacity *= 2;
    const grown = new Uint8Array(capacity);
    grown.set(this.buffer.subarray(0, this.written));
    this.buffer = grown;
  }
}
