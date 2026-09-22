import { describe, expect, it } from "vitest";
import { formatRef, isArtefactRef, parseRef, resolveRef } from "@/sim";
import type { ParsedRef } from "@/sim/types";
import { fixtureEvidence } from "./helpers/evidence-fixture";

const EXAMPLES: [string, ParsedRef][] = [
  ["disk:qf-lt-07:mft/101", { kind: "file", image: "qf-lt-07", record: 101 }],
  ["disk:qf-lt-07:carve/0", { kind: "carve", image: "qf-lt-07", offset: 0 }],
  ["mem:qf-srv-01-mem:pid/4120", { kind: "process", image: "qf-srv-01-mem", pid: 4120 }],
  ["mem:qf-srv-01-mem:conn/0", { kind: "connection", image: "qf-srv-01-mem", index: 0 }],
  ["mem:qf-srv-01-mem:vad/2097152", { kind: "region", image: "qf-srv-01-mem", base: 2097152 }],
  ["log:security/57", { kind: "log", source: "security", seq: 57 }],
  ["log:sysmon-lite/3", { kind: "log", source: "sysmon-lite", seq: 3 }],
  ["log:web-access/1", { kind: "log", source: "web-access", seq: 1 }],
];

describe("parseRef and formatRef", () => {
  it.each(EXAMPLES)("round-trips %s", (ref, parsed) => {
    expect(parseRef(ref)).toEqual(parsed);
    expect(formatRef(parsed)).toBe(ref);
    expect(isArtefactRef(ref)).toBe(true);
  });

  it.each([
    "",
    "disk:qf-lt-07:mft/",
    "disk:qf-lt-07:mft/01", // one spelling only: no leading zeros
    "disk:qf-lt-07:mft/-1",
    "disk:qf-lt-07:mft/1.5",
    "disk:QF-LT-07:mft/1", // ids are lowercase
    "disk:qf:lt:mft/1",
    "disk:qf-lt-07:inode/1",
    "mem:x:proc/1",
    "log:syslog/1",
    "log:security/99999999999999999999", // past the safe-integer range
    " log:security/1",
  ])("rejects %j", (ref) => {
    expect(parseRef(ref)).toBeUndefined();
    expect(isArtefactRef(ref)).toBe(false);
  });

  it("refuses to format a ref that couldn't be parsed back", () => {
    expect(() => formatRef({ kind: "file", image: "C:", record: 1 })).toThrow(RangeError);
    expect(() => formatRef({ kind: "log", source: "security", seq: -1 })).toThrow(RangeError);
    expect(() => formatRef({ kind: "process", image: "x", pid: 1.5 })).toThrow(RangeError);
  });

  it("round-trips and resolves every ref the fixture evidence has", () => {
    const evidence = fixtureEvidence();
    const refs = [
      ...evidence.disks.flatMap((d) =>
        d.records.map((r) => formatRef({ kind: "file", image: d.id, record: r.record })),
      ),
      ...evidence.memory.flatMap((m) => [
        ...m.processes.map((p) => formatRef({ kind: "process", image: m.id, pid: p.pid })),
        ...m.connections.map((_, index) => formatRef({ kind: "connection", image: m.id, index })),
        ...m.regions.map((r) => formatRef({ kind: "region", image: m.id, base: r.base })),
      ]),
      ...evidence.logs.map((l) => formatRef({ kind: "log", source: l.source, seq: l.seq })),
    ];
    expect(refs.length).toBeGreaterThan(20);
    for (const ref of refs) {
      const parsed = parseRef(ref);
      expect(parsed, ref).toBeDefined();
      expect(formatRef(parsed!)).toBe(ref);
      expect(resolveRef(evidence, ref), ref).toBeDefined();
    }
  });
});

describe("resolveRef", () => {
  const evidence = fixtureEvidence();

  it("finds a file record", () => {
    const found = resolveRef(evidence, "disk:qf-lt-07:mft/101");
    expect(found?.kind).toBe("file");
    if (found?.kind === "file") {
      expect(found.file.path).toBe("C:\\Users\\dana\\Documents\\inv-0412.pdf");
      expect(found.disk.id).toBe("qf-lt-07");
    }
  });

  it("finds a carve offset only inside unallocated space", () => {
    expect(resolveRef(evidence, "disk:qf-lt-07:carve/63")).toMatchObject({
      kind: "carve",
      offset: 63,
    });
    expect(resolveRef(evidence, "disk:qf-lt-07:carve/64")).toBeUndefined();
  });

  it("finds a process, a connection and a region", () => {
    expect(resolveRef(evidence, "mem:qf-srv-01-mem:pid/4120")).toMatchObject({
      kind: "process",
      process: { name: "svchost.exe", unlinked: true },
    });
    expect(resolveRef(evidence, "mem:qf-srv-01-mem:conn/0")).toMatchObject({
      kind: "connection",
      index: 0,
      connection: { remote: "203.0.113.47:443" },
    });
    expect(resolveRef(evidence, "mem:qf-srv-01-mem:vad/2097152")).toMatchObject({
      kind: "region",
      region: { protection: "PAGE_EXECUTE_READWRITE" },
    });
  });

  it("finds a log record by source and sequence number", () => {
    expect(resolveRef(evidence, "log:security/1")).toMatchObject({
      kind: "log",
      record: { eventId: 4624 },
    });
    // seq 1 exists in several sources: the source decides which.
    expect(resolveRef(evidence, "log:dns/1")).toMatchObject({
      kind: "log",
      record: { source: "dns" },
    });
  });

  it.each([
    "disk:qf-lt-99:mft/101", // no such disk
    "disk:qf-lt-07:mft/999", // no such record
    "mem:qf-srv-01-mem:pid/1", // no such process
    "mem:qf-srv-01-mem:conn/1", // past the last connection
    "mem:qf-srv-01-mem:vad/1", // no region at that base
    "mem:qf-lt-07:pid/4", // a disk id isn't a memory image
    "log:vpn/2",
    "not a ref",
  ])("returns undefined for %s", (ref) => {
    expect(resolveRef(evidence, ref)).toBeUndefined();
  });
});
