import { describe, expect, it } from "vitest";
import { baseName, deepFreeze, mountRead, mountWrite, parentPath } from "@/sim";
import type { DiskImage } from "@/sim/types";
import { FIXTURE_DISK } from "./helpers/evidence-fixture";

const MOUNTED_AT = Date.parse("2026-04-13T10:15:00Z");

/** The disk with every access time blanked out, so two disks can be compared on everything else. */
const withoutAccessTimes = (disk: DiskImage) => ({
  ...disk,
  records: disk.records.map((r) => ({ ...r, times: { ...r.times, a: 0 } })),
});

describe("mountRead", () => {
  const view = mountRead(FIXTURE_DISK);

  it("lists every record, live and deleted, in record order", () => {
    expect(view.records.map((r) => r.record)).toEqual([5, 30, 40, 41, 100, 101]);
    expect(view.record(101)?.deleted).toBe(true);
    expect(view.record(7)).toBeUndefined();
  });

  it("finds records by path, ignoring case like Windows", () => {
    expect(view.atPath("c:\\users\\DANA\\documents\\NOTES.txt").map((r) => r.record)).toEqual([
      100,
    ]);
    expect(view.atPath("C:\\Users\\dana\\Documents\\").map((r) => r.record)).toEqual([41]);
    expect(view.atPath("C:\\nowhere")).toEqual([]);
  });

  it("lists a folder's children, including deleted ones", () => {
    expect(view.children("C:\\Users\\dana\\Documents").map((r) => r.record)).toEqual([100, 101]);
    expect(view.children("C:\\").map((r) => r.record)).toEqual([30]);
  });

  it("decodes a file's content", () => {
    const notes = view.record(100)!;
    expect(new TextDecoder().decode(view.content(notes))).toBe("Order more pallet wrap.\n");
  });

  it("changes nothing", () => {
    const frozen = deepFreeze(structuredClone(FIXTURE_DISK));
    const v = mountRead(frozen);
    v.atPath("C:\\Users");
    v.children("C:\\");
    expect(frozen).toEqual(FIXTURE_DISK);
  });
});

describe("mountWrite", () => {
  it("gives every live record a new access time, and changes nothing else", () => {
    const original = deepFreeze(structuredClone(FIXTURE_DISK));
    const mounted = mountWrite(original, MOUNTED_AT);

    expect(original).toEqual(FIXTURE_DISK); // the input is untouched (and frozen, so it can't be)
    expect(mounted).not.toBe(original);
    expect(withoutAccessTimes(mounted)).toEqual(withoutAccessTimes(original));
    for (const record of mounted.records) {
      const before = original.records.find((r) => r.record === record.record)!;
      const { a, ...otherTimes } = record.times;
      const { a: aBefore, ...otherTimesBefore } = before.times;
      expect(otherTimes).toEqual(otherTimesBefore);
      expect(a).toBe(record.deleted ? aBefore : MOUNTED_AT);
    }
  });

  it("never touches a deleted record: nothing can open it", () => {
    const mounted = mountWrite(FIXTURE_DISK, MOUNTED_AT, { records: [100, 101] });
    expect(mounted.records.find((r) => r.record === 101)).toBe(
      FIXTURE_DISK.records.find((r) => r.record === 101),
    );
  });

  it("can touch only the records the system opened", () => {
    const mounted = mountWrite(FIXTURE_DISK, MOUNTED_AT, { records: [100] });
    const changed = mounted.records.filter(
      (r, i) => r.times.a !== FIXTURE_DISK.records[i]!.times.a,
    );
    expect(changed.map((r) => r.record)).toEqual([100]);
  });

  it("leaves a mountRead view of the result reading the new times", () => {
    const view = mountRead(mountWrite(FIXTURE_DISK, MOUNTED_AT));
    expect(view.record(100)?.times.a).toBe(MOUNTED_AT);
    expect(mountRead(FIXTURE_DISK).record(100)?.times.a).not.toBe(MOUNTED_AT);
  });

  it("refuses a time that isn't one", () => {
    expect(() => mountWrite(FIXTURE_DISK, Number.NaN)).toThrow(RangeError);
  });
});

describe("Windows paths", () => {
  it.each([
    ["C:\\Users\\dana\\a.txt", "C:\\Users\\dana"],
    ["C:\\Users", "C:\\"],
    ["C:\\Users\\", "C:\\"],
    ["C:\\", undefined],
  ])("the parent of %s is %s", (path, parent) => {
    expect(parentPath(path)).toBe(parent);
  });

  it("takes the last part of a path", () => {
    expect(baseName("C:\\Users\\dana\\a.txt")).toBe("a.txt");
    expect(baseName("C:\\Users\\")).toBe("Users");
    expect(baseName("C:\\")).toBe("C:\\");
  });
});
