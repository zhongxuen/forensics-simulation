import { describe, expect, it } from "vitest";
import {
  buildTree,
  filePartition,
  flatten,
  hexRow,
  NO_FILTER,
  showTime,
  tableRows,
  textContent,
  wallTimeToInstant,
} from "@/features/evidence-browser";
import { attachEvidence, build, createInitialState, mountRead, mountWrite } from "@/sim";
import { WORKSTATION } from "@/content/sandbox/workstation";

/**
 * The Evidence Browser's pure model (src/features/evidence-browser/model/): the tree, the table's
 * scope, sort and filters, times in two zones, and how content is shown as text and hex.
 */

const disk = build
  .disk("qf-lt-09")
  .partition("System reserved", { sectors: 64 })
  .partition("Windows", { sectors: 1984 })
  .file("C:\\Users\\dana\\a.txt", { record: 40, content: "aaaa", at: "2026-04-09T10:00:00Z" })
  .file("C:\\Users\\dana\\b.txt", {
    record: 41,
    content: "b",
    at: "2026-04-11T19:00:00Z",
    deleted: true,
  })
  .build();
const view = mountRead(disk);

describe("the tree", () => {
  const evidence = build.evidence("model").disk(disk).build();
  const sim = attachEvidence(createInitialState(WORKSTATION.scenario, WORKSTATION.seed), evidence);
  const device = "/dev/evidence/qf-lt-09";

  it("shows an unopened image with nothing under it: nothing has read it", () => {
    const [image] = buildTree(sim, {});
    expect(image?.opened).toBeUndefined();
    expect(image?.children).toEqual([]);
  });

  it("puts the folders on the largest partition, and none on the small one", () => {
    const [image] = buildTree(sim, { [device]: { view } });
    expect(image?.children.map((node) => node.kind === "partition" && node.holdsFiles)).toEqual([
      false,
      true,
    ]);
    expect(filePartition(disk.partitions)?.label).toBe("Windows");
    const folders = flatten(image?.children ?? []).flatMap((node) =>
      node.kind === "folder" ? [node.record.path] : [],
    );
    expect(folders).toEqual(["C:\\", "C:\\Users", "C:\\Users\\dana"]);
  });

  it("marks a view stale once the image under it has changed", () => {
    const changed = mountRead(mountWrite(disk, Date.UTC(2026, 3, 12)));
    const [image] = buildTree(sim, { [device]: { view: changed } });
    expect(image?.stale).toBe(true);
  });
});

describe("the table", () => {
  it("lists a folder's records, sorted", () => {
    const rows = tableRows(view, "C:\\Users\\dana", NO_FILTER, {
      column: "size",
      direction: "descending",
    });
    expect(rows.map((row) => row.record)).toEqual([40, 41]);
  });

  it("widens to the whole drive while a filter is on", () => {
    const deleted = tableRows(
      view,
      "C:\\Users",
      { ...NO_FILTER, deletedOnly: true },
      {
        column: "name",
        direction: "ascending",
      },
    );
    expect(deleted.map((row) => row.record)).toEqual([41]);
    const recent = tableRows(
      view,
      undefined,
      { deletedOnly: false, field: "m", from: Date.UTC(2026, 3, 11) },
      { column: "record", direction: "ascending" },
    );
    expect(recent.map((row) => row.record)).toEqual([41]);
  });
});

describe("times", () => {
  it("shows UTC, or the drive's zone with its offset", () => {
    const at = Date.UTC(2026, 3, 11, 19, 40, 12);
    expect(showTime(at, "UTC")).toBe("2026-04-11T19:40:12Z");
    expect(showTime(at, "Europe/London")).toBe("2026-04-11 20:40:12 +01:00");
  });

  it("reads a wall-clock time in the zone it's shown in", () => {
    expect(wallTimeToInstant("2026-04-11T20:40", "Europe/London")).toBe(
      Date.UTC(2026, 3, 11, 19, 40),
    );
    expect(wallTimeToInstant("2026-01-11T20:40:05", "Europe/London")).toBe(
      Date.UTC(2026, 0, 11, 20, 40, 5),
    );
    expect(wallTimeToInstant("2026-04-11T20:40", "UTC")).toBe(Date.UTC(2026, 3, 11, 20, 40));
    expect(wallTimeToInstant("yesterday", "UTC")).toBeUndefined();
    expect(wallTimeToInstant("2031-04-11T20:40", "Europe/London")).toBeUndefined();
  });
});

describe("content", () => {
  it("shows text as text, and the readable runs of anything else", () => {
    expect(textContent(new TextEncoder().encode("hello\nthere"))).toEqual({
      kind: "text",
      text: "hello\nthere",
    });
    expect(
      textContent(new Uint8Array([0x4d, 0x5a, 0, 1, 2, 0x72, 0x65, 0x61, 0x64, 0x79, 0])),
    ).toEqual({
      kind: "strings",
      strings: ["ready"],
    });
    expect(textContent(new Uint8Array())).toEqual({ kind: "empty" });
  });

  it("lays a hex row out as offset, 16 bytes and ASCII, padding a short last row", () => {
    const bytes = new TextEncoder().encode("MZ\u0000abcdefghijklmnopq");
    expect(hexRow(bytes, 0)).toEqual({
      offset: "00000000",
      hex: "4d 5a 00 61 62 63 64 65  66 67 68 69 6a 6b 6c 6d",
      ascii: "MZ.abcdefghijklm",
    });
    expect(hexRow(bytes, 1).offset).toBe("00000010");
    expect(hexRow(bytes, 1).hex.startsWith("6e 6f 70 71    ")).toBe(true);
    expect(hexRow(bytes, 1).ascii).toBe("nopq");
  });
});
