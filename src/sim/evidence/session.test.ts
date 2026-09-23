import { describe, expect, it } from "vitest";
import { imageHash } from "./image";
import {
  attachEvidence,
  deviceAt,
  EVIDENCE_ROOT,
  imageAt,
  isEvidencePath,
  pathsForImage,
  readOriginal,
  rememberOutput,
  setBlocker,
} from "./session";
import type { AttachedItem } from "./session";
import {
  bareState,
  caseEvidence,
  caseState,
  CASE_NOW,
  DEVICE_PATH,
  formSha256,
  runCase,
  text,
} from "../tools/forensics/__fixtures__/evidence";

const device = (state: ReturnType<typeof caseState>): AttachedItem =>
  state.evidence?.attached["qf-lt-07"] as AttachedItem;

describe("attachEvidence", () => {
  it("puts one device under /dev/evidence per disk image, with its blocker on", () => {
    const state = caseState();
    expect(Object.keys(state.evidence?.attached ?? {})).toEqual(["qf-lt-07"]);
    expect(device(state)).toMatchObject({
      id: "qf-lt-07",
      path: `${EVIDENCE_ROOT}/qf-lt-07`,
      blocker: true,
    });
    expect(imageAt(state.evidence as never, DEVICE_PATH)?.id).toBe("qf-lt-07");
    expect(deviceAt(state.evidence as never, DEVICE_PATH)?.id).toBe("qf-lt-07");
  });

  it("makes the device show up in ls and explain itself to cat, instead of printing bytes", () => {
    const state = caseState();
    expect(text(runCase(state, "ls", EVIDENCE_ROOT))).toContain("qf-lt-07");
    const read = text(runCase(state, "cat", DEVICE_PATH));
    expect(read).toContain("This is evidence, not a file.");
    expect(read).toContain("Fenwold M2 solid-state drive");
    expect(read).toContain("acquire /dev/evidence/qf-lt-07");
  });

  it("owns the device by root, so the player's account can read it and never write to it", () => {
    const state = caseState();
    expect(text(runCase(state, "ls", "-l", EVIDENCE_ROOT))).toMatch(/root\s+root/);
    const overwrite = runCase(state, "touch", DEVICE_PATH);
    expect(overwrite.output.flatMap((line) => (line.error ? [line.error.code] : []))).toEqual([
      "EACCES",
    ]);
  });

  it("leaves a workstation with no evidence alone", () => {
    expect(bareState().evidence).toBeUndefined();
  });
});

describe("the evidence session", () => {
  it("knows what is on the evidence device and what is not", () => {
    expect(isEvidencePath(DEVICE_PATH)).toBe(true);
    expect(isEvidencePath(EVIDENCE_ROOT)).toBe(true);
    expect(isEvidencePath("/dev/evidence/../evidence/qf-lt-07")).toBe(true);
    expect(isEvidencePath("/home/examiner/cases/qf-lt-07.img")).toBe(false);
    expect(isEvidencePath("/dev/null")).toBe(false);
  });

  it("points a bare image id at a working copy first, and the original when there is none", () => {
    const start = caseState();
    expect(pathsForImage(start.evidence as never, "qf-lt-07")).toEqual([DEVICE_PATH]);
    const copied = runCase(
      start,
      "acquire",
      DEVICE_PATH,
      "--out",
      "/home/examiner/cases/case-01/images/qf-lt-07.img",
    ).state;
    expect(pathsForImage(copied.evidence as never, "qf-lt-07")).toEqual([
      "/home/examiner/cases/case-01/images/qf-lt-07.img",
      DEVICE_PATH,
    ]);
    expect(pathsForImage(copied.evidence as never, "qf-lt-99")).toEqual([]);
  });

  it("turns a write-blocker on and off, and ignores a device it doesn't have", () => {
    const off = setBlocker(caseState(), "qf-lt-07", false);
    expect(device(off).blocker).toBe(false);
    expect(device(setBlocker(off, "qf-lt-07", true)).blocker).toBe(true);
    expect(setBlocker(caseState(), "qf-lt-99", false).evidence).toEqual(caseState().evidence);
    expect(setBlocker(bareState(), "qf-lt-07", false).evidence).toBeUndefined();
  });
});

describe("readOriginal", () => {
  it("changes nothing while the blocker is on", () => {
    const state = caseState();
    const read = readOriginal(state, device(state), "lsfs", CASE_NOW);
    expect(read.blocker).toBe(true);
    expect(read.state).toBe(state);
    expect(imageHash("sha256", read.view.image)).toBe(formSha256());
  });

  it("sets a new access time on every live record with the blocker off, and keeps it", () => {
    const state = setBlocker(caseState(), "qf-lt-07", false);
    const read = readOriginal(state, device(state), "lsfs", CASE_NOW);
    expect(read.blocker).toBe(false);
    expect(imageHash("sha256", read.view.image)).not.toBe(formSha256());
    expect(read.view.records.filter((r) => !r.deleted).every((r) => r.times.a === CASE_NOW)).toBe(
      true,
    );
    // Deleted records are untouched: nothing can open them.
    const deleted = read.view.record(51);
    expect(deleted?.times.a).toBe(
      caseEvidence().disks[0]?.records.find((r) => r.record === 51)?.times.a,
    );
    // And the change lasts: a second read sees the same drive.
    expect(imageAt(read.state.evidence as never, DEVICE_PATH)).toBe(read.view.image);
    expect(read.state.evidence?.attached["qf-lt-07"]?.changedAt).toBe(CASE_NOW);
  });

  it("refuses to read a device with no image behind it, which would be a bug", () => {
    const state = caseState();
    const missing: AttachedItem = { id: "ghost", path: "/dev/evidence/ghost", blocker: true };
    expect(() => readOriginal(state, missing, "lsfs", CASE_NOW)).toThrow(/no image attached/);
  });
});

describe("rememberOutput", () => {
  it("keeps each line's text and ref, and does nothing without evidence", () => {
    const next = rememberOutput(caseState(), "lsfs qf-lt-07", [
      { stream: "stdout", text: "heading" },
      { stream: "stdout", text: "a record", ref: "disk:qf-lt-07:mft/51" },
    ]);
    expect(next.evidence?.lastCommand).toBe("lsfs qf-lt-07");
    expect(next.evidence?.lastOutput).toEqual([
      { text: "heading" },
      { text: "a record", ref: "disk:qf-lt-07:mft/51" },
    ]);
    expect(rememberOutput(bareState(), "lsfs", []).evidence).toBeUndefined();
  });
});

describe("attachEvidence, when the machine can't take it", () => {
  it("throws rather than half-attaching", () => {
    const broken = { ...bareState(), machines: {} };
    expect(() => attachEvidence(broken, caseEvidence())).toThrow(/has no filesystem/);
  });
});
