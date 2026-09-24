import { describe, expect, it } from "vitest";
import { utf8Bytes } from "./bytes";
import {
  CARVE_TYPES,
  carveAt,
  carveBytes,
  carvedObjectAt,
  indexOfBytes,
  isCarveType,
  signatureAt,
  signatureFor,
  SIGNATURES,
} from "./magic";
import {
  invoicePdf,
  PLANTED,
  storedZip,
  tinyJpeg,
  tinyPng,
  UNALLOCATED,
} from "../tools/forensics/__fixtures__/carve-logs";

const join = (...parts: (string | Uint8Array)[]): Uint8Array => {
  const bytes = parts.map((part) => (typeof part === "string" ? utf8Bytes(part) : part));
  const out = new Uint8Array(bytes.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of bytes) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const zeros = (n: number) => new Uint8Array(n);

describe("the signature table", () => {
  it("has one entry per carve type, each citing its specification", () => {
    expect(SIGNATURES.map((signature) => signature.type)).toEqual([...CARVE_TYPES]);
    for (const signature of SIGNATURES) {
      expect(signature.citation.length, signature.type).toBeGreaterThan(40);
      expect(signatureFor(signature.type)).toBe(signature);
    }
    expect(signatureFor("pdf").citation).toMatch(/ISO 32000/);
    expect(signatureFor("zip").citation).toMatch(/APPNOTE/);
    expect(signatureFor("jpg").citation).toMatch(/T\.81/);
    expect(signatureFor("png").citation).toMatch(/PNG Specification/);
  });

  it("holds the header bytes the specifications give", () => {
    const hex = (type: (typeof CARVE_TYPES)[number]) =>
      [...signatureFor(type).header].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    expect(hex("pdf")).toBe("25 50 44 46 2d"); // %PDF-
    expect(hex("zip")).toBe("50 4b 03 04");
    expect(hex("jpg")).toBe("ff d8 ff");
    expect(hex("png")).toBe("89 50 4e 47 0d 0a 1a 0a");
  });

  it("knows its own type names", () => {
    expect(CARVE_TYPES.every(isCarveType)).toBe(true);
    expect(isCarveType("gif")).toBe(false);
  });
});

describe("indexOfBytes and signatureAt", () => {
  it("finds a run of bytes, within a window", () => {
    const bytes = utf8Bytes("abcabc");
    expect(indexOfBytes(bytes, utf8Bytes("bc"))).toBe(1);
    expect(indexOfBytes(bytes, utf8Bytes("bc"), 2)).toBe(4);
    expect(indexOfBytes(bytes, utf8Bytes("bc"), 2, 5)).toBe(-1);
    expect(indexOfBytes(bytes, utf8Bytes("zz"))).toBe(-1);
  });

  it("names the signature starting at an offset, and nothing mid-way through one", () => {
    const bytes = join("xx", tinyPng());
    expect(signatureAt(bytes, 2)?.type).toBe("png");
    expect(signatureAt(bytes, 3)).toBeUndefined();
  });
});

describe("carving", () => {
  it("cuts a complete object of every type, byte for byte", () => {
    const objects: [string, Uint8Array][] = [
      ["pdf", utf8Bytes(invoicePdf("one line"))],
      ["zip", storedZip("a.txt", "hello")],
      ["jpg", tinyJpeg("camera")],
      ["png", tinyPng()],
    ];
    for (const [type, bytes] of objects) {
      const found = carveBytes(join(zeros(10), bytes, zeros(10)));
      expect(found, type).toHaveLength(1);
      expect(found[0]).toMatchObject({ offset: 10, type, size: bytes.length, complete: true });
      expect(found[0]?.bytes).toEqual(bytes);
    }
  });

  it("takes a PDF's last end-of-line with it, and a ZIP's comment", () => {
    const crlf = join("%PDF-1.4 x %%EOF\r\n", "more");
    expect(carveAt(crlf, 0)?.size).toBe("%PDF-1.4 x %%EOF\r\n".length);

    const zip = storedZip("a.txt", "hello");
    const commented = join(zip.slice(0, -2), Uint8Array.of(3, 0), "abc", zeros(4));
    expect(carveAt(commented, 0)).toMatchObject({ complete: true, size: zip.length + 3 });
  });

  it("marks an object with no end marker partial, and stops it at the next header", () => {
    const partial = utf8Bytes("%PDF-1.4 1 0 obj << /Type /Catalog");
    const zip = storedZip("b.txt", "later");
    const found = carveBytes(join(partial, "overwritten", zip));
    expect(found.map(({ type, complete }) => [type, complete])).toEqual([
      ["pdf", false],
      ["zip", true],
    ]);
    expect(found[0]?.size).toBe(partial.length + "overwritten".length);
    expect(found[1]?.offset).toBe(partial.length + "overwritten".length);
  });

  it("runs a partial object on to the end of the space when nothing follows it", () => {
    const found = carveBytes(join("%PDF-1.4 cut short", zeros(20)));
    expect(found[0]).toMatchObject({ complete: false, size: 38 });
  });

  it("doesn't take the next PDF's end marker for its own", () => {
    const whole = invoicePdf("second");
    const found = carveBytes(join("%PDF-1.4 cut short ", whole));
    expect(found.map((object) => object.complete)).toEqual([false, true]);
    expect(found[1]?.bytes).toEqual(utf8Bytes(whole));
  });

  it("carves a ZIP once, not again for a file stored inside it", () => {
    const inner = invoicePdf("inside");
    const zip = storedZip("inner.pdf", inner);
    const found = carveBytes(join(zeros(4), zip));
    expect(found.map((object) => object.type)).toEqual(["zip"]);
  });

  it("reports only the types asked for, while every header still ends a partial one", () => {
    const bytes = join("%PDF-1.4 cut short", tinyPng(), zeros(4));
    expect(carveBytes(bytes, ["pdf"])).toMatchObject([{ type: "pdf", size: 18 }]);
    expect(carveBytes(bytes, ["png"])).toMatchObject([{ type: "png", offset: 18 }]);
    expect(carveBytes(bytes, [])).toEqual([]);
  });

  it("finds nothing in empty or signature-free space", () => {
    expect(carveBytes(new Uint8Array(0))).toEqual([]);
    expect(carveBytes(utf8Bytes("PK is two letters, %PDF is four"))).toEqual([]);
  });

  it("resolves an object by its exact offset, and nothing else", () => {
    const [first] = PLANTED;
    expect(carvedObjectAt(UNALLOCATED.bytes, first?.offset ?? -1)?.type).toBe("pdf");
    expect(carvedObjectAt(UNALLOCATED.bytes, (first?.offset ?? 0) + 1)).toBeUndefined();
    expect(carvedObjectAt(UNALLOCATED.bytes, 0)).toBeUndefined();
  });
});
