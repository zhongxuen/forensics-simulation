import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "../core/rng";
import * as build from "./builder";
import { resolveRef } from "./refs";
import {
  buildTimeline,
  compareEntries,
  compareRefs,
  isMacbKind,
  macbKind,
  TIMELINE_SOURCES,
  type TimelineEntry,
} from "./timeline";
import { LOG_SOURCES, type EvidenceSet, type MacbTimes } from "./types";

const T = (iso: string) => Date.parse(iso);

/**
 * Every entry's `at` is exactly the instant stored on the artefact its ref resolves to, and its
 * kind says which instant that is. Returns the problems, so a failure names the entry.
 */
function timelineProblems(set: EvidenceSet, entries: readonly TimelineEntry[]): string[] {
  const problems: string[] = [];
  for (const entry of entries) {
    const found = resolveRef(set, entry.ref);
    const label = `${entry.ref} ${entry.kind} @${entry.at}`;
    if (!found) {
      problems.push(`${label}: the ref resolves to nothing`);
      continue;
    }
    switch (found.kind) {
      case "file": {
        const times = found.file.times;
        if (entry.source !== "disk" || !isMacbKind(entry.kind)) {
          problems.push(`${label}: a file record's entry must be a disk MACB entry`);
        } else if (entry.kind !== macbKind(times, entry.at)) {
          problems.push(`${label}: the record's times give ${macbKind(times, entry.at)}`);
        }
        if (entry.host !== found.disk.id) problems.push(`${label}: host ${entry.host}`);
        break;
      }
      case "process":
        if (entry.kind !== "process-start" || entry.at !== found.process.createdAt) {
          problems.push(`${label}: the process started at ${found.process.createdAt}`);
        }
        if (entry.host !== found.image.host) problems.push(`${label}: host ${entry.host}`);
        break;
      case "connection":
        if (entry.kind !== "connection" || entry.at !== found.connection.createdAt) {
          problems.push(`${label}: the connection was made at ${found.connection.createdAt}`);
        }
        if (entry.host !== found.image.host) problems.push(`${label}: host ${entry.host}`);
        break;
      case "log":
        if (entry.source !== found.record.source || entry.at !== found.record.at) {
          problems.push(`${label}: the record is at ${found.record.at}`);
        }
        if (entry.host !== found.record.host) problems.push(`${label}: host ${entry.host}`);
        break;
      default:
        problems.push(`${label}: a ${found.kind} has no time, so it has no place on the timeline`);
    }
  }
  return problems;
}

/** How many entries a set must give: one per distinct MACB time, process, connection and log. */
function expectedCount(set: EvidenceSet): number {
  let count = set.logs.length;
  for (const disk of set.disks) {
    for (const file of disk.records) count += new Set(Object.values(file.times)).size;
  }
  for (const image of set.memory) count += image.processes.length + image.connections.length;
  return count;
}

/**
 * A random evidence set. Times come from a small pool, so MACB times collide often, and entries
 * from different sources land on the same second.
 */
function randomSet(rng: Rng): EvidenceSet {
  const base = T("2026-04-11T19:00:00Z");
  const pool = Array.from({ length: 12 }, () => base + rng.int(0, 7_200) * 1_000);
  const time = () => rng.pick(pool);

  const disk = build.disk("qf-lt-07");
  const files = rng.int(1, 12);
  for (let i = 0; i < files; i++) {
    const path = `C:\\Users\\dana\\Documents\\f${i}.txt`;
    disk.file(path, {
      content: `file ${i}`,
      times: { m: time(), a: time(), c: time(), b: time() },
    });
    if (rng.int(0, 3) === 0) disk.deleted(path);
  }
  const mem = build.memory("qf-srv-01", { capturedAt: base + 7_200_000 });
  const processes = rng.int(0, 6);
  for (let i = 0; i < processes; i++) {
    mem.process(`p${i}.exe`, { createdAt: time() });
    if (rng.int(0, 1) === 1) mem.connection(`203.0.113.${i + 1}:443`, { createdAt: time() });
  }
  const set = build.evidence("case-prop", { seed: rng.seed }).disk(disk).memory(mem);
  const logs = rng.int(0, 20);
  for (let i = 0; i < logs; i++) {
    const source = rng.pick(LOG_SOURCES);
    const eventId =
      source === "security"
        ? rng.pick([4624, 4625, 4634, 4672, 4688, 4999])
        : source === "sysmon-lite"
          ? rng.pick([1, 3, 11, 23])
          : undefined;
    set.log(
      source,
      time(),
      { TargetUserName: "dana", action: "block", query: "cdn-sync.example" },
      eventId === undefined ? {} : { eventId },
    );
  }
  return set.build();
}

/** A copy of `set` with every list inside it in a different order. */
function shuffled(set: EvidenceSet, rng: Rng): EvidenceSet {
  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  };
  return {
    ...set,
    disks: shuffle(set.disks).map((disk) => ({ ...disk, records: shuffle(disk.records) })),
    // Connections are refs by index, so their order is part of the evidence: keep it.
    memory: shuffle(set.memory).map((image) => ({ ...image, processes: shuffle(image.processes) })),
    logs: shuffle(set.logs),
  };
}

describe("buildTimeline", () => {
  it("merges equal MACB times into one entry, and splits different ones", () => {
    const set = build
      .evidence("case-t")
      .disk(
        build
          .disk("qf-lt-07")
          .file("C:\\a.txt", { record: 40, at: "2026-04-11T19:00:00Z" })
          .file("C:\\b.txt", {
            record: 41,
            at: "2026-04-11T19:00:00Z",
            times: {
              m: "2026-04-11T19:41:02Z",
              c: "2026-04-11T19:41:02Z",
              a: "2026-04-11T19:50:00Z",
            },
          }),
      )
      .build();
    const entries = buildTimeline(set);
    const of = (record: number) =>
      entries
        .filter((e) => e.ref === `disk:qf-lt-07:mft/${record}`)
        .map((e) => [new Date(e.at).toISOString(), e.kind]);
    expect(of(40)).toEqual([["2026-04-11T19:00:00.000Z", "MACB"]]);
    expect(of(41)).toEqual([
      ["2026-04-11T19:00:00.000Z", "...B"],
      ["2026-04-11T19:41:02.000Z", "M.C."],
      ["2026-04-11T19:50:00.000Z", ".A.."],
    ]);
  });

  it("writes MACB kinds with a dot for every time that is elsewhere", () => {
    const times: MacbTimes = { m: 1, a: 2, c: 1, b: 3 };
    expect(macbKind(times, 1)).toBe("M.C.");
    expect(macbKind(times, 2)).toBe(".A..");
    expect(macbKind(times, 3)).toBe("...B");
    expect(isMacbKind("M.C.")).toBe(true);
    expect(isMacbKind("....")).toBe(false);
    expect(isMacbKind("4624")).toBe(false);
  });

  it("marks deleted files and folders in the summary, and names the drive as the host", () => {
    const set = build
      .evidence("case-t")
      .disk(build.disk("qf-lt-07").file("C:\\Users\\dana\\x.txt").deleted("C:\\Users\\dana\\x.txt"))
      .build();
    const summaries = buildTimeline(set).map((e) => e.summary);
    expect(summaries).toContain("C:\\Users\\dana\\x.txt (deleted)");
    expect(summaries).toContain("C:\\Users\\dana\\");
    expect(new Set(buildTimeline(set).map((e) => e.host))).toEqual(new Set(["qf-lt-07"]));
  });

  it("gives memory its process starts and connections, and every log record one entry", () => {
    const set = build
      .evidence("case-t", { host: "qf-srv-01" })
      .memory(
        build
          .memory("qf-srv-01", { capturedAt: "2026-04-11T21:00:00Z" })
          .process("rdpclip.exe", { pid: 4120, createdAt: "2026-04-11T19:40:15Z", user: "dana" })
          .connection("203.0.113.47:443", { createdAt: "2026-04-11T19:40:20Z" }),
      )
      .log(
        "security",
        "2026-04-11T19:40:12Z",
        { TargetUserName: "dana", LogonType: "10", IpAddress: "203.0.113.47" },
        { eventId: 4624 },
      )
      .log("dns", "2026-04-11T19:40:19Z", {
        client: "10.60.1.10",
        query: "cdn-sync.example",
        answer: "203.0.113.47",
      })
      .log("firewall", "2026-04-11T19:40:20Z", {
        action: "allow",
        proto: "tcp",
        src: "10.60.1.10",
        dst: "203.0.113.47",
        dpt: "443",
      })
      .log("web-access", "2026-04-11T19:40:30Z", {
        clientIp: "198.51.100.9",
        method: "POST",
        path: "/login",
        status: "200",
      })
      .log("vpn", "2026-04-11T19:40:40Z", { event: "connect", user: "dana", src: "192.0.2.10" })
      .log(
        "sysmon-lite",
        "2026-04-11T19:40:15Z",
        { Image: "C:\\Windows\\System32\\rdpclip.exe", User: "dana" },
        { eventId: 1 },
      )
      .build();
    const lines = buildTimeline(set).map((e) => `${e.source} ${e.kind} ${e.ref} ${e.summary}`);
    expect(lines).toEqual([
      "security 4624 log:security/1 An account was successfully logged on. TargetUserName=dana LogonType=10 IpAddress=203.0.113.47",
      "memory process-start mem:qf-srv-01-mem:pid/4120 rdpclip.exe (pid 4120, parent 0) as dana: C:\\Windows\\System32\\rdpclip.exe",
      "sysmon-lite 1 log:sysmon-lite/1 Process created. Image=C:\\Windows\\System32\\rdpclip.exe User=dana",
      "dns query log:dns/1 A cdn-sync.example from 10.60.1.10 -> NOERROR 203.0.113.47",
      "memory connection mem:qf-srv-01-mem:conn/0 TCPv4 10.60.1.10:49811 -> 203.0.113.47:443 ESTABLISHED (rdpclip.exe, pid 4120)",
      "firewall allow log:firewall/1 proto=tcp src=10.60.1.10 dst=203.0.113.47 dpt=443",
      'web-access POST log:web-access/1 198.51.100.9 "POST /login" 200',
      "vpn connect log:vpn/1 user=dana src=192.0.2.10",
    ]);
  });

  it("titles an event id it doesn't know by name, and still gives its fields", () => {
    const set = build
      .evidence("case-t")
      .log("security", "2026-04-11T19:40:12Z", { Zeta: "1", Alpha: "2" }, { eventId: 4999 })
      .build();
    expect(buildTimeline(set)[0]).toMatchObject({ kind: "4999", summary: "Event. Alpha=2 Zeta=1" });
  });

  it("breaks ties at the same second by source, then by ref as a number", () => {
    const at = "2026-04-11T19:40:00Z";
    const set = build
      .evidence("case-t")
      .disk(
        build
          .disk("qf-lt-07")
          .file("C:\\a.txt", { record: 9, at })
          .file("C:\\b.txt", { record: 42, at }),
      )
      .memory(build.memory("qf-srv-01").process("a.exe", { pid: 8, createdAt: at }))
      .log("vpn", at, { event: "connect" })
      .log("security", at, {}, { eventId: 4624, seq: 10 })
      .log("security", at, {}, { eventId: 4624, seq: 2 })
      .build();
    const refs = buildTimeline(set)
      .filter((e) => e.at === T(at))
      .map((e) => e.ref);
    expect(refs).toEqual([
      "disk:qf-lt-07:mft/9",
      "disk:qf-lt-07:mft/42",
      "mem:qf-srv-01-mem:pid/8",
      "log:security/2",
      "log:security/10",
      "log:vpn/1",
    ]);
  });

  it("orders refs by their text, then their number", () => {
    expect(compareRefs("disk:a:mft/9", "disk:a:mft/42")).toBeLessThan(0);
    expect(compareRefs("disk:a:mft/42", "disk:b:mft/1")).toBeLessThan(0);
    expect(compareRefs("log:dns/3", "log:dns/3")).toBe(0);
  });

  it("lists the sources in the same order the timeline breaks ties", () => {
    expect(TIMELINE_SOURCES).toEqual(["disk", "memory", ...LOG_SOURCES]);
  });

  it("is empty for evidence with nothing in it", () => {
    expect(buildTimeline(build.evidence("case-t").build())).toEqual([]);
  });
});

describe("buildTimeline, over 200 random evidence sets", () => {
  const seeds = Array.from({ length: 200 }, (_, i) => 9_000 + i);

  it("puts every entry at exactly the instant on the artefact its ref resolves to", () => {
    for (const seed of seeds) {
      const set = randomSet(createRng(seed));
      const entries = buildTimeline(set);
      expect(timelineProblems(set, entries), `seed ${seed}`).toEqual([]);
      expect(entries, `seed ${seed}`).toHaveLength(expectedCount(set));
    }
  });

  it("gives the same timeline whatever order the evidence lists things in", () => {
    for (const seed of seeds) {
      const set = randomSet(createRng(seed));
      const again = buildTimeline(shuffled(set, createRng(seed + 1)));
      expect(again, `seed ${seed}`).toEqual(buildTimeline(set));
    }
  });

  it("is sorted, and no two entries compare equal", () => {
    for (const seed of seeds) {
      const entries = buildTimeline(randomSet(createRng(seed)));
      for (let i = 1; i < entries.length; i++) {
        expect(
          compareEntries(entries[i - 1] as TimelineEntry, entries[i] as TimelineEntry),
        ).toBeLessThan(0);
      }
    }
  });
});
