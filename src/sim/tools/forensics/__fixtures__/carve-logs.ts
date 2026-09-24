/**
 * The evidence carve, strings and logq are tested against (docs/plan/07-carve-strings-logq.md).
 *
 * Built with the evidence builder, like every tool fixture. The drive is Quillfen Freight's
 * bookkeeper's laptop, `qf-lt-07`, and the logs and memory come from the dispatch server,
 * `qf-srv-01` (docs/plan/99-reference.md §New world facts):
 *
 * - a deleted invoice PDF whose tail a live log file has since been written over: `recover`
 *   refuses it, and its first part survives in unallocated space as a partial PDF;
 * - a deleted ZIP that nothing has touched: `recover` writes it out and `carve` finds it whole;
 * - a small JPEG and PNG in unallocated space, so every signature is carved at least once;
 * - forty logons that did not succeed, from one office address, within five minutes, among a
 *   little ordinary traffic;
 * - a memory image with strings owned by two processes, and one whose owner isn't known.
 *
 * `PLANTED` lists what was put in unallocated space and where, which is what the carving
 * differential test compares `carve`'s output with, byte for byte.
 */
import { fixedClock } from "../../../core/clock";
import { createInitialState } from "../../../core/scenario";
import { step } from "../../../core/step";
import type { SimResult, SimState } from "../../../core/types";
import * as build from "../../../evidence/builder";
import { utf8Bytes } from "../../../evidence/bytes";
import type { CarveType } from "../../../evidence/magic";
import { attachEvidence } from "../../../evidence/session";
import type { EvidenceSet } from "../../../evidence/types";
import { sh } from "../../../__fixtures__/shell";
import { CASE_NOW, CASE_SCENARIO, CASE_SEED } from "./evidence";

export const DEVICE = "/dev/evidence/qf-lt-07";
export const CARVE_OUT = "/home/examiner/cases/case-01/export/carved";

export const RECORDS = {
  invoice0412: 42,
  /** Deleted; its second cluster now belongs to the sync log. */
  invoice0413: 51,
  syncLog: 60,
  /** Deleted, clusters untouched. */
  statements: 64,
} as const;

// ---------------------------------------------------------------------------------------------
// File formats, written out byte by byte so the carver has something real to find.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** CRC-32 as ZIP and PNG both use it (ISO 3309, the polynomial in PKWARE's APPNOTE §4.4.7). */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const u16 = (n: number) => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff);
const u32le = (n: number) =>
  Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
const u32be = (n: number) =>
  Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);

/** A ZIP with one stored (uncompressed) entry: local header, data, central directory, end record. */
export function storedZip(name: string, content: string): Uint8Array {
  const file = utf8Bytes(name);
  const data = utf8Bytes(content);
  const crc = crc32(data);
  const time = u16((19 << 11) | (41 << 5)); // 19:41:00, DOS format
  const date = u16(((2026 - 1980) << 9) | (4 << 5) | 11); // 2026-04-11
  const local = concat(
    Uint8Array.of(0x50, 0x4b, 0x03, 0x04),
    u16(20), // version needed
    u16(0), // flags
    u16(0), // stored
    time,
    date,
    u32le(crc),
    u32le(data.length),
    u32le(data.length),
    u16(file.length),
    u16(0),
    file,
    data,
  );
  const central = concat(
    Uint8Array.of(0x50, 0x4b, 0x01, 0x02),
    u16(20), // version made by
    u16(20),
    u16(0),
    u16(0),
    time,
    date,
    u32le(crc),
    u32le(data.length),
    u32le(data.length),
    u16(file.length),
    u16(0), // extra
    u16(0), // comment
    u16(0), // disk
    u16(0), // internal attributes
    u32le(0), // external attributes
    u32le(0), // offset of the local header
    file,
  );
  const end = concat(
    Uint8Array.of(0x50, 0x4b, 0x05, 0x06),
    u16(0),
    u16(0),
    u16(1),
    u16(1),
    u32le(central.length),
    u32le(local.length),
    u16(0),
  );
  return concat(local, central, end);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typed = concat(utf8Bytes(type), data);
  return concat(u32be(data.length), typed, u32be(crc32(typed)));
}

/** A 1×1 grey PNG: signature, IHDR, IDAT and IEND, each chunk with its CRC. */
export function tinyPng(): Uint8Array {
  return concat(
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    pngChunk("IHDR", concat(u32be(1), u32be(1), Uint8Array.of(8, 0, 0, 0, 0))),
    pngChunk("IDAT", Uint8Array.of(0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01)),
    pngChunk("IEND", new Uint8Array(0)),
  );
}

/** A JPEG reduced to its markers: SOI, a JFIF APP0, a comment, and EOI. */
export function tinyJpeg(comment: string): Uint8Array {
  const text = utf8Bytes(comment);
  return concat(
    Uint8Array.of(0xff, 0xd8), // SOI
    Uint8Array.of(0xff, 0xe0, 0x00, 0x10), // APP0, 16 bytes
    utf8Bytes("JFIF\0"),
    Uint8Array.of(0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00),
    Uint8Array.of(0xff, 0xfe),
    u16(text.length + 2),
    text,
    Uint8Array.of(0xff, 0xd9), // EOI
  );
}

/** A small, well-formed PDF with one line of text on its page. */
export function invoicePdf(line: string): string {
  const stream = `BT /F1 12 Tf 72 720 Td (${line}) Tj ET`;
  return [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj",
    `4 0 obj << /Length ${stream.length} >> stream`,
    stream,
    "endstream endobj",
    "trailer << /Root 1 0 R >>",
    "%%EOF",
    "",
  ].join("\n");
}

export const INVOICE_0413 = invoicePdf(
  "Quillfen Freight invoice 0413: overnight haulage, Thursday run",
);
/** What the sync log wrote over the rest of it. */
export const SYNC_LOG = "19:44:10 sync started\n19:44:12 sync finished\n";
/** How much of invoice 0413 survived before the sync log landed on it. */
export const SURVIVING = INVOICE_0413.indexOf("overnight haulage");

export const STATEMENTS_ZIP = storedZip(
  "statements-april.csv",
  "date,reference,amount\n2026-04-02,INV-0412,1240.00\n2026-04-10,INV-0413,860.00\n",
);

/** One object planted in unallocated space, and whether its end survives. */
export interface Planted {
  readonly offset: number;
  readonly type: CarveType;
  readonly bytes: Uint8Array;
  readonly complete: boolean;
}

/**
 * The unallocated space, laid out on purpose: filler, the surviving start of invoice 0413 with the
 * sync log over its tail, the ZIP, a JPEG and a PNG. Filler is zeros with a little readable noise
 * in it, the way free space holds scraps of whatever was there before.
 */
function unallocated(): { bytes: Uint8Array; planted: Planted[] } {
  const pieces: Uint8Array[] = [];
  const planted: Planted[] = [];
  let at = 0;
  const add = (bytes: Uint8Array) => {
    pieces.push(bytes);
    at += bytes.length;
  };
  const padTo = (offset: number) => add(new Uint8Array(offset - at));
  const plant = (type: CarveType, bytes: Uint8Array, complete = true) => {
    planted.push({ offset: at, type, bytes, complete });
    add(bytes);
  };

  add(utf8Bytes("wuauclt: checking for updates"));
  padTo(512);
  plant("pdf", utf8Bytes(INVOICE_0413.slice(0, SURVIVING)), false);
  add(utf8Bytes(SYNC_LOG));
  padTo(1024);
  plant("zip", STATEMENTS_ZIP);
  padTo(1536);
  plant("jpg", tinyJpeg("yard gate camera 2"));
  padTo(1792);
  plant("png", tinyPng());
  padTo(2048);
  return { bytes: concat(...pieces), planted };
}

export const UNALLOCATED = unallocated();
export const PLANTED: readonly Planted[] = UNALLOCATED.planted;

// ---------------------------------------------------------------------------------------------
// The evidence set.

/** The burst: forty logons that did not succeed, from the yard office laptop, seven seconds apart. */
export const BURST = {
  from: "10.60.0.21",
  count: 40,
  start: Date.UTC(2026, 3, 11, 19, 2, 0),
  users: ["administrator", "admin", "dispatch", "dana", "yard"],
} as const;

export function carveEvidence(): EvidenceSet {
  const disk = build
    .disk("qf-lt-07", { model: "Fenwold M2 solid-state drive", serial: "FW-2291-0067" })
    .file("C:\\Users\\dana\\Documents\\inv-0412.pdf", {
      record: RECORDS.invoice0412,
      clusters: [1000, 1001],
      content: invoicePdf("Quillfen Freight invoice 0412: pallet wrap, 3 rolls"),
      at: "2026-04-02T09:14:00Z",
    })
    .file("C:\\Users\\dana\\Documents\\inv-0413.pdf", {
      record: RECORDS.invoice0413,
      clusters: [1002, 1003],
      content: INVOICE_0413,
      at: "2026-04-10T16:41:00Z",
      times: { m: "2026-04-11T19:41:02Z", c: "2026-04-11T19:42:03Z" },
    })
    .file("C:\\Windows\\Temp\\sync.log", {
      record: RECORDS.syncLog,
      clusters: [1003],
      content: SYNC_LOG,
      at: "2026-04-11T19:44:12Z",
    })
    .file("C:\\Users\\dana\\Downloads\\statements-april.zip", {
      record: RECORDS.statements,
      clusters: [1005],
      content: STATEMENTS_ZIP,
      at: "2026-04-09T11:20:00Z",
    })
    .deleted("C:\\Users\\dana\\Documents\\inv-0413.pdf")
    .deleted("C:\\Users\\dana\\Downloads\\statements-april.zip")
    .unallocated(UNALLOCATED.bytes);

  const mem = build
    .memory("qf-srv-01", { capturedAt: "2026-04-12T08:40:00Z" })
    .string("Quillfen Freight dispatch")
    .process("svchost.exe", { pid: 4120, createdAt: "2026-04-11T19:07:40Z" })
    .string("cdn-sync.example")
    .string("203.0.113.47:443")
    .string("rdp")
    .process("explorer.exe", { pid: 2208, user: "dispatch" })
    .string("C:\\Users\\dispatch\\Desktop\\routes.xlsx");

  let set = build
    .evidence("case-07-fixture", { seed: CASE_SEED, host: "qf-srv-01" })
    .disk(disk)
    .memory(mem)
    .zone("security", "Europe/London")
    .handover("qf-lt-07", { hashes: true, receivedAt: "2026-04-12T08:05:00Z" })
    .log(
      "security",
      "2026-04-11T08:14:55Z",
      logonFailure("dana", "10.60.0.27", "QF-LT-07", 50112),
      {
        eventId: 4625,
      },
    )
    .log("security", "2026-04-11T08:15:20Z", logonSuccess("dana", "10.60.0.27", "QF-LT-07", 3), {
      eventId: 4624,
    })
    .log("firewall", "2026-04-11T19:01:58Z", {
      action: "allow",
      proto: "tcp",
      src: BURST.from,
      spt: "51000",
      dst: "10.60.1.10",
      dpt: "3389",
    });
  for (let i = 0; i < BURST.count; i++) {
    const user = BURST.users[i % BURST.users.length] as string;
    set = set.log(
      "security",
      BURST.start + i * 7_000,
      logonFailure(user, BURST.from, "QF-LT-03", 51001 + i),
      {
        eventId: 4625,
      },
    );
  }
  return set
    .log("security", "2026-04-11T19:07:10Z", logonSuccess("dispatch", BURST.from, "QF-LT-03", 10), {
      eventId: 4624,
    })
    .log("dns", "2026-04-11T19:07:52Z", {
      client: "10.60.1.10",
      query: "cdn-sync.example",
      type: "A",
      rcode: "NOERROR",
      answer: "203.0.113.47",
    })
    .build();
}

function logonFailure(user: string, ip: string, workstation: string, port: number) {
  const known = user === "dana" || user === "dispatch";
  return {
    TargetUserName: user,
    TargetDomainName: "QUILLFEN",
    LogonType: "10",
    Status: "0xC000006D",
    SubStatus: known ? "0xC000006A" : "0xC0000064",
    FailureReason: "Unknown user name or bad password.",
    WorkstationName: workstation,
    IpAddress: ip,
    IpPort: String(port),
  };
}

function logonSuccess(user: string, ip: string, workstation: string, type: number) {
  return {
    SubjectUserName: "-",
    SubjectDomainName: "-",
    TargetUserName: user,
    TargetDomainName: "QUILLFEN",
    LogonType: String(type),
    LogonProcessName: type === 10 ? "User32" : "NtLmSsp",
    AuthenticationPackageName: "Negotiate",
    WorkstationName: workstation,
    IpAddress: ip,
    IpPort: "0",
    TargetLogonId: type === 10 ? "0x3E7A21" : "0x2B9C04",
  };
}

/** The workstation with this evidence attached, every write-blocker on. */
export function carveState(): SimState {
  return attachEvidence(createInitialState(CASE_SCENARIO, CASE_SEED), carveEvidence(), {
    now: Date.UTC(2026, 3, 12, 8, 5, 0),
  });
}

/** Runs one parsed command line, pipes and all, on the examiner's fixed clock. */
export const runLine = (state: SimState, line: string): SimResult =>
  step(state, sh(line), fixedClock(CASE_NOW));
