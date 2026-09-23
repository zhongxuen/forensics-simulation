/**
 * How a record's content is shown: as text when it reads as text, as the readable runs inside it
 * when it doesn't, and as a hex dump (offset, 16 bytes, ASCII) either way. Pure, over the bytes the
 * engine's read view returned.
 */

export const BYTES_PER_ROW = 16;

/** How many hex rows `length` bytes make. */
export const hexRowCount = (length: number): number => Math.ceil(length / BYTES_PER_ROW);

/** One row of a hex dump. */
export interface HexRow {
  /** "00000010": the offset of the row's first byte, in hex. */
  readonly offset: string;
  /** "4d 5a 90 00 …", padded so the ASCII column lines up on a short last row. */
  readonly hex: string;
  /** Printable ASCII as itself, everything else as a dot. */
  readonly ascii: string;
}

const printable = (byte: number) => byte >= 0x20 && byte < 0x7f;

export function hexRow(bytes: Uint8Array, row: number): HexRow {
  const start = row * BYTES_PER_ROW;
  const slice = bytes.subarray(start, start + BYTES_PER_ROW);
  const cells: string[] = [];
  for (let i = 0; i < BYTES_PER_ROW; i++) {
    const byte = slice[i];
    cells.push(byte === undefined ? "  " : byte.toString(16).padStart(2, "0"));
    // A wider gap after the eighth byte, the way hex viewers split a row in two.
    if (i === 7) cells.push("");
  }
  let ascii = "";
  for (const byte of slice) ascii += printable(byte) ? String.fromCharCode(byte) : ".";
  return { offset: start.toString(16).padStart(8, "0"), hex: cells.join(" "), ascii };
}

/** What the Text tab shows. */
export type TextContent =
  | { readonly kind: "empty" }
  | { readonly kind: "text"; readonly text: string }
  /** Not text: the runs of readable characters found in it, the way a strings view shows them. */
  | { readonly kind: "strings"; readonly strings: readonly string[] };

/** The shortest run of readable characters worth listing from a file that isn't text. */
export const MIN_STRING = 4;

/**
 * Text when the bytes decode as UTF-8 with few control characters (tabs and line breaks are
 * fine); otherwise the readable runs of at least MIN_STRING characters.
 */
export function textContent(bytes: Uint8Array): TextContent {
  if (bytes.length === 0) return { kind: "empty" };
  const text = new TextDecoder("utf-8").decode(bytes);
  let odd = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const control = code < 0x20 && char !== "\n" && char !== "\r" && char !== "\t";
    if (control || code === 0x7f || char === "�") odd++;
  }
  if (odd <= text.length / 50) return { kind: "text", text };
  return { kind: "strings", strings: readableRuns(bytes) };
}

function readableRuns(bytes: Uint8Array): string[] {
  const runs: string[] = [];
  let current = "";
  for (const byte of bytes) {
    if (printable(byte)) {
      current += String.fromCharCode(byte);
      continue;
    }
    if (current.length >= MIN_STRING) runs.push(current);
    current = "";
  }
  if (current.length >= MIN_STRING) runs.push(current);
  return runs;
}
