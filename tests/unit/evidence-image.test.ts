import { describe, expect, it } from "vitest";
import {
  hashHex,
  imageBytes,
  imageHash,
  IMAGE_FORMAT_MAGIC,
  mountRead,
  mountWrite,
  build,
} from "@/sim";
import type { DiskImage } from "@/sim/types";
import { FIXTURE_DISK } from "./helpers/evidence-fixture";

const MOUNTED_AT = Date.parse("2026-04-13T10:15:00Z");

const sha256Of = (disk: DiskImage) => hashHex("sha256", imageBytes(disk));

describe("imageBytes", () => {
  it("starts with the format's magic, so a changed layout is obvious", () => {
    const magic = new TextDecoder().decode(imageBytes(FIXTURE_DISK).subarray(0, 8));
    expect(magic).toBe(IMAGE_FORMAT_MAGIC);
  });

  it("gives the same bytes for the same image, every time", () => {
    const once = imageBytes(FIXTURE_DISK);
    const again = imageBytes(structuredClone(FIXTURE_DISK));
    expect(Array.from(again)).toEqual(Array.from(once));
  });

  it("doesn't depend on the order records and partitions happen to be in", () => {
    const shuffled: DiskImage = { ...FIXTURE_DISK, records: [...FIXTURE_DISK.records].reverse() };
    expect(sha256Of(shuffled)).toBe(sha256Of(FIXTURE_DISK));
  });

  it("holds each file's content, zero-filled to the end of its last cluster", () => {
    const one = build
      .disk("qf-lt-07", { clusterSize: 16 })
      .file("C:\\a.txt", { content: "hello" })
      .build();
    const bytes = imageBytes(one);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("hello");
    // 5 bytes of content in one 16-byte cluster leaves 11 bytes of slack.
    const start = text.indexOf("hello") + "hello".length;
    expect(Array.from(bytes.subarray(start, start + 11))).toEqual(Array.from(new Uint8Array(11)));
  });

  it("holds the unallocated space, where deleted content still lives", () => {
    const carved = build.disk("qf-lt-07").unallocated("%PDF-1.4 inv-0412").build();
    expect(new TextDecoder().decode(imageBytes(carved))).toContain("%PDF-1.4 inv-0412");
  });
});

describe("a changed image has a changed hash", () => {
  it.each([
    ["an access time", (d: DiskImage) => mountWrite(d, MOUNTED_AT)],
    [
      "a modified time",
      (d: DiskImage): DiskImage => ({
        ...d,
        records: d.records.map((r, i) =>
          i === 0 ? { ...r, times: { ...r.times, m: r.times.m + 1 } } : r,
        ),
      }),
    ],
    [
      "one byte of file content",
      (d: DiskImage): DiskImage => ({
        ...d,
        records: d.records.map((r) =>
          r.record === 100 ? { ...r, contentB64: "T3JkZXIgbW9yZSBwYWxsZXQgd3JhcC4h" } : r,
        ),
      }),
    ],
    [
      "the deleted flag",
      (d: DiskImage): DiskImage => ({
        ...d,
        records: d.records.map((r) => (r.record === 100 ? { ...r, deleted: true } : r)),
      }),
    ],
    ["the unallocated space", (d: DiskImage): DiskImage => ({ ...d, unallocatedB64: "QQ==" })],
    [
      "the device serial",
      (d: DiskImage): DiskImage => ({ ...d, device: { ...d.device, serial: "X" } }),
    ],
  ])("changing %s changes the bytes", (_, change) => {
    expect(sha256Of(change(FIXTURE_DISK))).not.toBe(sha256Of(FIXTURE_DISK));
  });
});

describe("Case 1's wrong turn", () => {
  it("reading with a write-blocker keeps the hash, mounting read-write breaks it", () => {
    const handover = imageHash("sha256", FIXTURE_DISK);

    // A write-blocked read: open the image, list it, read a file. Nothing changes.
    const view = mountRead(FIXTURE_DISK);
    view.children("C:\\Users\\dana\\Documents");
    view.content(view.record(100)!);
    expect(imageHash("sha256", view.image)).toBe(handover);

    // The original plugged into a normal computer: every live file gets a new access time.
    const mounted = mountWrite(FIXTURE_DISK, MOUNTED_AT);
    expect(imageHash("sha256", mounted)).not.toBe(handover);
    expect(imageHash("md5", mounted)).not.toBe(imageHash("md5", FIXTURE_DISK));

    // Only the access times moved: the files themselves are untouched, which is exactly why the
    // mistake is easy to make and hard to argue away afterwards.
    expect(mounted.records.map((r) => r.contentB64)).toEqual(
      FIXTURE_DISK.records.map((r) => r.contentB64),
    );
  });
});
