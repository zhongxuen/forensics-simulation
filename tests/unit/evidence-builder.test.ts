import { describe, expect, it } from "vitest";
import { build, decodeBase64, EvidenceSetSchema, imageHash, mountRead, resolveRef } from "@/sim";

/**
 * The fluent builder waves 2 and 3 make their fixtures with. What matters here is that five lines
 * give a valid evidence set, and that everything it fills in by itself — record numbers, clusters,
 * parent folders, pids, sequence numbers — comes out the same every time.
 */
const { disk, evidence, memory, toInstant } = build;

const text = (b64: string) => new TextDecoder().decode(decodeBase64(b64));

describe("five lines make an evidence set", () => {
  const set = evidence("case-01", { seed: 7 })
    .disk(
      disk("qf-lt-07").file("C:\\Users\\dana\\Documents\\inv-0412.pdf", { content: "%PDF-1.4" }),
    )
    .memory(
      memory("qf-srv-01").process("svchost.exe", { unlinked: true }).connection("203.0.113.47:443"),
    )
    .log("security", "2026-04-11T19:40:12Z", { TargetUserName: "dana" }, { eventId: 4624 })
    .build();

  it("validates against the schema", () => {
    expect(() => EvidenceSetSchema.parse(set)).not.toThrow();
  });

  it("can be pointed at by a ref", () => {
    expect(resolveRef(set, "log:security/1")?.kind).toBe("log");
    expect(resolveRef(set, "disk:qf-lt-07:mft/7")?.kind).toBe("file");
    expect(resolveRef(set, "mem:qf-srv-01-mem:pid/1000")?.kind).toBe("process");
  });

  it("builds the same set twice", () => {
    const again = evidence("case-01", { seed: 7 })
      .disk(
        disk("qf-lt-07").file("C:\\Users\\dana\\Documents\\inv-0412.pdf", { content: "%PDF-1.4" }),
      )
      .memory(
        memory("qf-srv-01")
          .process("svchost.exe", { unlinked: true })
          .connection("203.0.113.47:443"),
      )
      .log("security", "2026-04-11T19:40:12Z", { TargetUserName: "dana" }, { eventId: 4624 })
      .build();
    expect(again).toEqual(set);
  });
});

describe("disk", () => {
  it("makes the folders above a file, numbering records as it goes", () => {
    const image = disk("qf-lt-07").file("C:\\Users\\dana\\Documents\\notes.txt").build();
    expect(image.records.map((r) => [r.record, r.path, r.kind])).toEqual([
      [5, "C:\\", "dir"],
      [6, "C:\\Users", "dir"],
      [7, "C:\\Users\\dana", "dir"],
      [8, "C:\\Users\\dana\\Documents", "dir"],
      [9, "C:\\Users\\dana\\Documents\\notes.txt", "file"],
    ]);
  });

  it("takes a file's size, content and clusters from what it was given", () => {
    const image = disk("qf-lt-07", { clusterSize: 8 })
      .file("C:\\a.txt", { content: "0123456789" })
      .build();
    const file = mountRead(image).atPath("C:\\a.txt")[0]!;
    expect(file.size).toBe(10);
    expect(text(file.contentB64)).toBe("0123456789");
    expect(file.clusters).toEqual([1000, 1001]); // two 8-byte clusters, none shared
  });

  it("reads the owner off a user's path, and gives everything else to SYSTEM", () => {
    const image = disk("qf-lt-07")
      .file("C:\\Users\\dana\\notes.txt")
      .file("C:\\Windows\\System32\\config\\SAM")
      .build();
    const owners = Object.fromEntries(image.records.map((r) => [r.path, r.owner]));
    expect(owners["C:\\Users\\dana\\notes.txt"]).toBe("dana");
    expect(owners["C:\\Users"]).toBe("SYSTEM");
    expect(owners["C:\\Windows\\System32\\config\\SAM"]).toBe("SYSTEM");
  });

  it("sets all four MACB times, and lets one be moved on its own", () => {
    const image = disk("qf-lt-07")
      .file("C:\\a.txt", {
        at: "2026-04-01T08:00:00Z",
        times: { a: "2026-04-11T19:42:03Z" },
      })
      .build();
    const file = mountRead(image).atPath("C:\\a.txt")[0]!;
    expect(file.times).toEqual({
      m: Date.parse("2026-04-01T08:00:00Z"),
      a: Date.parse("2026-04-11T19:42:03Z"),
      c: Date.parse("2026-04-01T08:00:00Z"),
      b: Date.parse("2026-04-01T08:00:00Z"),
    });
  });

  it("deletes a file without taking its content or clusters away", () => {
    const image = disk("qf-lt-07")
      .file("C:\\Users\\dana\\inv-0412.pdf", { content: "%PDF-1.4" })
      .deleted("C:\\Users\\dana\\inv-0412.pdf")
      .build();
    const file = mountRead(image).atPath("C:\\Users\\dana\\inv-0412.pdf")[0]!;
    expect(file.deleted).toBe(true);
    expect(text(file.contentB64)).toBe("%PDF-1.4");
    expect(file.clusters).toHaveLength(1);
  });

  it("says so when asked to delete a file that isn't there", () => {
    expect(() => disk("qf-lt-07").deleted("C:\\nowhere.txt")).toThrow(/no record/);
  });
});

describe("memory", () => {
  const image = memory("qf-srv-01", { capturedAt: "2026-04-14T10:05:00Z" })
    .process("System", { pid: 4, threads: 120 })
    .process("svchost.exe", { ppid: 4, unlinked: true, user: "svc-update" })
    .connection("203.0.113.47:443")
    .region({ protection: "PAGE_EXECUTE_READWRITE", preview: "MZ" })
    .string("cdn-sync.example")
    .build();

  it("gives out Windows-shaped pids and attaches everything to the process added last", () => {
    // Pids it chooses itself start at 1000 and climb in fours, and never drop back below a pid a
    // test asked for by name, so two processes can't end up sharing one.
    expect(image.processes.map((p) => p.pid)).toEqual([4, 1004]);
    expect(image.connections[0]?.pid).toBe(1004);
    expect(image.regions[0]?.pid).toBe(1004);
    expect(image.strings[0]?.pid).toBe(1004);
  });

  it("names the image after its host and keeps the capture time", () => {
    expect(image.id).toBe("qf-srv-01-mem");
    expect(image.capturedAt).toBe(Date.parse("2026-04-14T10:05:00Z"));
    expect(image.processes[1]?.unlinked).toBe(true);
  });
});

describe("logs and handover", () => {
  it("numbers records within each source, from 1", () => {
    const set = evidence("case-02")
      .log("security", "2026-04-11T19:40:12Z", {}, { eventId: 4624 })
      .log("dns", "2026-04-11T19:41:00Z", { query: "cdn-sync.example" })
      .log("security", "2026-04-11T19:45:00Z", {}, { eventId: 4634 })
      .build();
    expect(set.logs.map((r) => `${r.source}/${r.seq}`)).toEqual([
      "security/1",
      "dns/1",
      "security/2",
    ]);
  });

  it("puts the image's real hashes on the handover form", () => {
    const image = disk("qf-lt-07").file("C:\\a.txt", { content: "hello" }).build();
    const set = evidence("case-01").disk(image).handover("qf-lt-07", { hashes: true }).build();
    expect(set.handover[0]?.hashes).toEqual({
      md5: imageHash("md5", image),
      sha256: imageHash("sha256", image),
    });
  });

  it("refuses to hash an item it has never seen", () => {
    expect(() => evidence("case-01").handover("qf-lt-99", { hashes: true })).toThrow(/no disk/);
  });
});

describe("toInstant", () => {
  it("takes UTC ISO times and plain instants", () => {
    expect(toInstant("2026-04-11T19:42:03Z")).toBe(Date.parse("2026-04-11T19:42:03Z"));
    expect(toInstant(1_775_000_000_000)).toBe(1_775_000_000_000);
  });

  it("refuses a time whose zone is anyone's guess", () => {
    expect(() => toInstant("2026-04-11 19:42:03")).toThrow(/UTC ISO/);
    expect(() => toInstant("2026-04-11T19:42:03+01:00")).toThrow(/UTC ISO/);
    expect(() => toInstant(Number.NaN)).toThrow(/not an instant/);
  });
});
