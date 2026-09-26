/**
 * File signatures, and carving by them (docs/plan/07-carve-strings-logq.md).
 *
 * Most file formats open with a fixed run of bytes, their "magic number", and many close with one
 * too. Carving is searching raw bytes for those runs and cutting out what lies between them. It
 * needs no file record at all, which is why it still works on unallocated space after the record
 * is gone, and why what it finds has no name and no times: those lived in the record.
 *
 * Each entry cites the specification its bytes come from. The table is written from those
 * specifications, not from any carving tool's configuration.
 */

/** The kinds of file the carver knows, as the player types them after `--type`. */
export const CARVE_TYPES = ["pdf", "zip", "jpg", "png"] as const;
export type CarveType = (typeof CARVE_TYPES)[number];

export function isCarveType(value: string): value is CarveType {
  return (CARVE_TYPES as readonly string[]).includes(value);
}

export interface FileSignature {
  readonly type: CarveType;
  /** What a person would call it: "PDF document". */
  readonly label: string;
  /** The extension a carved copy is written out with. */
  readonly extension: string;
  /** The bytes a file of this type starts with. */
  readonly header: Uint8Array;
  /** The header as an examiner writes it down: "%PDF-", "FF D8 FF". */
  readonly headerText: string;
  /** How the end is recognised, in the same style: "%%EOF", "IEND + CRC". */
  readonly footerText: string;
  /**
   * Where the file that starts at `start` ends (exclusive), or undefined when no end marker is
   * found before `limit`.
   */
  readonly findEnd: (bytes: Uint8Array, start: number, limit: number) => number | undefined;
  /**
   * True when a second header of the same type means the first file has ended. A ZIP is the
   * exception: every entry inside it starts with a local file header of its own.
   */
  readonly stopsAtOwnHeader: boolean;
  /** Where the header and footer bytes are defined. */
  readonly citation: string;
}

const ascii = (text: string): Uint8Array => Uint8Array.from(text, (char) => char.charCodeAt(0));

/** The first index at or after `from` where `needle` starts, before `limit`, or -1. */
export function indexOfBytes(
  bytes: Uint8Array,
  needle: Uint8Array,
  from = 0,
  limit = bytes.length,
): number {
  const last = Math.min(limit, bytes.length) - needle.length;
  outer: for (let i = Math.max(0, from); i <= last; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

const startsWithAt = (bytes: Uint8Array, needle: Uint8Array, at: number): boolean =>
  indexOfBytes(bytes, needle, at, at + needle.length) === at;

const PDF_EOF = ascii("%%EOF");
const ZIP_EOCD = Uint8Array.of(0x50, 0x4b, 0x05, 0x06);
const JPEG_EOI = Uint8Array.of(0xff, 0xd9);
const PNG_IEND = ascii("IEND");

export const SIGNATURES: readonly FileSignature[] = [
  {
    type: "pdf",
    label: "PDF document",
    extension: "pdf",
    header: ascii("%PDF-"),
    headerText: "%PDF-",
    footerText: "%%EOF",
    findEnd(bytes, start, limit) {
      const eof = indexOfBytes(bytes, PDF_EOF, start + 5, limit);
      if (eof < 0) return undefined;
      // The marker sits on the file's last line, and that line usually ends in an end-of-line.
      let end = eof + PDF_EOF.length;
      if (bytes[end] === 0x0d) end++;
      if (bytes[end] === 0x0a) end++;
      return Math.min(end, limit);
    },
    stopsAtOwnHeader: true,
    citation:
      "ISO 32000-1:2008 (PDF 1.7), §7.5.2 File Header: the first line is %PDF-1.n; §7.5.5 File Trailer: the last line is %%EOF.",
  },
  {
    type: "zip",
    label: "ZIP archive",
    extension: "zip",
    header: Uint8Array.of(0x50, 0x4b, 0x03, 0x04),
    headerText: "PK 03 04",
    footerText: "end of central directory (PK 05 06)",
    findEnd(bytes, start, limit) {
      let at = indexOfBytes(bytes, ZIP_EOCD, start + 4, limit);
      while (at >= 0) {
        // The record is 22 bytes, then a comment whose length is the last field in it.
        const commentLength = (bytes[at + 20] ?? 0) | ((bytes[at + 21] ?? 0) << 8);
        const end = at + 22 + commentLength;
        if (end <= limit) return end;
        at = indexOfBytes(bytes, ZIP_EOCD, at + 1, limit);
      }
      return undefined;
    },
    stopsAtOwnHeader: false,
    citation:
      "PKWARE APPNOTE.TXT (.ZIP File Format Specification) 6.3.10, §4.3.7 Local file header, signature 0x04034b50; §4.3.16 End of central directory record, signature 0x06054b50, 22 bytes plus its comment.",
  },
  {
    type: "jpg",
    label: "JPEG image",
    extension: "jpg",
    header: Uint8Array.of(0xff, 0xd8, 0xff),
    headerText: "FF D8 FF",
    footerText: "FF D9",
    findEnd(bytes, start, limit) {
      const eoi = indexOfBytes(bytes, JPEG_EOI, start + 3, limit);
      return eoi < 0 ? undefined : eoi + JPEG_EOI.length;
    },
    stopsAtOwnHeader: false,
    citation:
      "ITU-T T.81 | ISO/IEC 10918-1, Annex B.1.1.3: SOI (start of image) is FF D8 and EOI (end of image) is FF D9. The third FF is the next marker, such as JFIF's APP0 (ITU-T T.871).",
  },
  {
    type: "png",
    label: "PNG image",
    extension: "png",
    header: Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    headerText: "89 50 4E 47 0D 0A 1A 0A",
    footerText: "IEND + CRC",
    findEnd(bytes, start, limit) {
      const iend = indexOfBytes(bytes, PNG_IEND, start + 8, limit);
      // The chunk type is followed by its 4-byte CRC, and IEND carries no data.
      return iend < 0 || iend + 8 > limit ? undefined : iend + 8;
    },
    stopsAtOwnHeader: true,
    citation:
      "PNG Specification, 2nd edition (W3C Recommendation, ISO/IEC 15948:2004), §5.2 PNG signature; §11.2.5 IEND Image trailer, the last chunk.",
  },
];

export function signatureFor(type: CarveType): FileSignature {
  return SIGNATURES.find((signature) => signature.type === type) as FileSignature;
}

/** The signature whose header starts at `at`, if any. */
export function signatureAt(bytes: Uint8Array, at: number): FileSignature | undefined {
  return SIGNATURES.find((signature) => startsWithAt(bytes, signature.header, at));
}

/** One object cut out of raw bytes by its signature. */
export interface CarvedObject {
  /** Where its header starts, in the bytes that were searched. */
  readonly offset: number;
  readonly type: CarveType;
  readonly size: number;
  /**
   * False when the header was found but no end marker: the rest of the file has been written
   * over, and the carve runs on to the next header or the end of the space.
   */
  readonly complete: boolean;
  readonly bytes: Uint8Array;
}

/** The next header of any known type after `from`, or `limit`. */
function nextHeader(bytes: Uint8Array, from: number, limit: number, only?: CarveType): number {
  for (let i = from; i < limit; i++) {
    const found = signatureAt(bytes, i);
    if (found && (only === undefined || found.type === only)) return i;
  }
  return limit;
}

/**
 * Cuts one object out of `bytes` at `offset`, or undefined when no known header starts there.
 * A complete object runs from its header to its end marker. With no end marker before the next
 * header (or the end of the bytes), the object is partial and runs up to that point.
 */
export function carveAt(bytes: Uint8Array, offset: number): CarvedObject | undefined {
  const signature = signatureAt(bytes, offset);
  if (!signature) return undefined;
  const after = offset + signature.header.length;
  const limit = signature.stopsAtOwnHeader
    ? nextHeader(bytes, after, bytes.length, signature.type)
    : bytes.length;
  const end = signature.findEnd(bytes, offset, limit);
  const stop = end ?? nextHeader(bytes, after, bytes.length);
  return {
    offset,
    type: signature.type,
    size: stop - offset,
    complete: end !== undefined,
    bytes: bytes.slice(offset, stop),
  };
}

/**
 * Every object in `bytes`, in offset order. A complete object is skipped over once carved, so a
 * file stored inside a ZIP is not carved a second time; a partial one is searched past from the
 * header that cut it short. Only `types` are reported, but every known header still ends a
 * partial object.
 */
export function carveBytes(
  bytes: Uint8Array,
  types: readonly CarveType[] = CARVE_TYPES,
): CarvedObject[] {
  const wanted = new Set(types);
  const found: CarvedObject[] = [];
  let i = 0;
  while (i < bytes.length) {
    const object = carveAt(bytes, i);
    if (!object) {
      i++;
      continue;
    }
    if (wanted.has(object.type)) found.push(object);
    i = object.complete ? object.offset + object.size : object.offset + 1;
  }
  return found;
}

/**
 * The object a carve ref names: one that starts exactly at `offset` in the same scan `carveBytes`
 * makes, so a ref printed by `carve` always resolves, and an offset in the middle of something
 * does not.
 */
export function carvedObjectAt(bytes: Uint8Array, offset: number): CarvedObject | undefined {
  return carveBytes(bytes).find((object) => object.offset === offset);
}
