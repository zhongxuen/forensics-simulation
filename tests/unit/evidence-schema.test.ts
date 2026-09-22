import { describe, expect, expectTypeOf, it } from "vitest";
import type * as z from "zod/mini";
import {
  ArtefactRefSchema,
  DiskImageSchema,
  EvidenceSetSchema,
  FileRecordSchema,
  LogRecordSchema,
  MemoryImageSchema,
} from "@/sim";
import type { DiskImage, EvidenceSet, FileRecord, LogRecord, MemoryImage } from "@/sim/types";
import { fixtureEvidence } from "./helpers/evidence-fixture";

/** The hand-written types are readonly; a schema's output is the same shape, writable. */
type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;

/** Parse a changed copy of the fixture and return the issue messages. */
function issues(change: (set: ReturnType<typeof fixtureEvidence>) => unknown): string[] {
  const set = structuredClone(fixtureEvidence()) as unknown as Record<string, unknown>;
  change(set as unknown as ReturnType<typeof fixtureEvidence>);
  const result = EvidenceSetSchema.safeParse(set);
  return result.success
    ? []
    : result.error.issues.map((i) => `${i.code} ${i.path.join(".")}: ${i.message}`);
}

describe("evidence schemas", () => {
  it("match the hand-written types exactly", () => {
    expectTypeOf<z.output<typeof FileRecordSchema>>().toEqualTypeOf<Mutable<FileRecord>>();
    expectTypeOf<z.output<typeof DiskImageSchema>>().toEqualTypeOf<Mutable<DiskImage>>();
    expectTypeOf<z.output<typeof MemoryImageSchema>>().toEqualTypeOf<Mutable<MemoryImage>>();
    expectTypeOf<z.output<typeof LogRecordSchema>>().toEqualTypeOf<Mutable<LogRecord>>();
    expectTypeOf<z.output<typeof EvidenceSetSchema>>().toEqualTypeOf<Mutable<EvidenceSet>>();
  });

  it("accept the fixture evidence set, unchanged", () => {
    const evidence = fixtureEvidence();
    expect(EvidenceSetSchema.parse(evidence)).toEqual(evidence);
  });

  it("round-trip through JSON: evidence is plain data", () => {
    const evidence = fixtureEvidence();
    expect(EvidenceSetSchema.parse(JSON.parse(JSON.stringify(evidence)))).toEqual(evidence);
  });

  it.each<[string, (set: EvidenceSet) => void, RegExp]>([
    ["an unknown key", (s) => Object.assign(s, { extra: 1 }), /unrecognized_keys/],
    [
      "an unknown log source",
      (s) => Object.assign(s.logs[0]!, { source: "syslog" }),
      /logs\.0\.source/,
    ],
    [
      "a duplicate log seq in one source",
      (s) => Object.assign(s.logs[1]!, { seq: 1 }),
      /duplicate log source and seq/,
    ],
    [
      "a duplicate record number",
      (s) => Object.assign(s.disks[0]!.records[1]!, { record: 5 }),
      /duplicate record number/,
    ],
    [
      "a size that doesn't match the content",
      (s) => Object.assign(s.disks[0]!.records[4]!, { size: 3 }),
      /doesn't match/,
    ],
    [
      "content that isn't base64",
      (s) => Object.assign(s.disks[0]!.records[4]!, { contentB64: "abc" }),
      /base64/,
    ],
    [
      "a path that isn't a Windows path",
      (s) => Object.assign(s.disks[0]!.records[4]!, { path: "/etc/passwd" }),
      /Windows path/,
    ],
    [
      "a sector size other than 512",
      (s) => Object.assign(s.disks[0]!, { sectorSize: 4096 }),
      /sectorSize/,
    ],
    [
      "an image id a ref can't hold",
      (s) => Object.assign(s.disks[0]!, { id: "QF:07" }),
      /disks\.0\.id/,
    ],
    [
      "a connection from a pid that isn't there",
      (s) => Object.assign(s.memory[0]!.connections[0]!, { pid: 9999 }),
      /pid 9999 isn't a process/,
    ],
    [
      "two regions at one base",
      (s) =>
        Object.assign(s.memory[0]!, {
          regions: [s.memory[0]!.regions[0], s.memory[0]!.regions[0]],
        }),
      /duplicate region base/,
    ],
    [
      "a zone outside the offset table",
      (s) => Object.assign(s.zones, { dns: "Europe/Paris" }),
      /offset table/,
    ],
    [
      "a zone for a source that doesn't exist",
      (s) => Object.assign(s.zones, { syslog: "UTC" }),
      /zones/,
    ],
    [
      "a time that isn't a whole millisecond",
      (s) => Object.assign(s.logs[0]!, { at: 1.5 }),
      /logs\.0\.at/,
    ],
    ["a short sha256", (s) => Object.assign(s.handover[0]!.hashes!, { sha256: "abc" }), /sha256/],
  ])("reject %s", (_, change, message) => {
    const found = issues(change);
    expect(found.length, "expected at least one issue").toBeGreaterThan(0);
    expect(found.join("\n")).toMatch(message);
  });

  it("check artefact refs", () => {
    expect(ArtefactRefSchema.safeParse("log:security/1").success).toBe(true);
    expect(ArtefactRefSchema.safeParse("log:security/01").success).toBe(false);
    expect(ArtefactRefSchema.safeParse(42).success).toBe(false);
  });
});
