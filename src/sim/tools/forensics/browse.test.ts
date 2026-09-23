import { describe, expect, it } from "vitest";
import { imageHash } from "../../evidence/image";
import {
  bareState,
  caseState,
  CASE_NOW,
  DEVICE_PATH,
  formSha256,
  IMAGE_PATH,
  RECORDS,
  runCase,
} from "./__fixtures__/evidence";
import { browsableImages, browseImage, BROWSER_TOOL } from "./browse";

describe("browsableImages", () => {
  it("lists the original device, with its write-blocker, and reads nothing", () => {
    const state = caseState();
    const images = browsableImages(state);
    expect(images.map((image) => image.path)).toEqual([DEVICE_PATH]);
    expect(images[0]?.device?.blocker).toBe(true);
    expect(images[0]?.id).toBe("qf-lt-07");
  });

  it("lists a working copy after the original, once acquire has written one", () => {
    const acquired = runCase(caseState(), "acquire", DEVICE_PATH, "--out", IMAGE_PATH);
    const images = browsableImages(acquired.state);
    expect(images.map((image) => image.path)).toEqual([DEVICE_PATH, IMAGE_PATH]);
    expect(images[1]?.device).toBeUndefined();
  });

  it("is empty on a workstation with no evidence", () => {
    expect(browsableImages(bareState())).toEqual([]);
  });
});

describe("browseImage", () => {
  it("opens the original through its write-blocker: nothing changes, and the read is recorded", () => {
    const state = caseState();
    const opened = browseImage(state, DEVICE_PATH, CASE_NOW);
    if (!opened.ok) throw new Error("expected the drive to open");
    expect(opened.value.state).toBe(state);
    expect(opened.value.warning).toBeUndefined();
    expect(opened.value.view.record(RECORDS.invoice0413)?.deleted).toBe(true);
    expect(opened.value.events).toEqual([
      { type: "evidence.readOriginal", device: DEVICE_PATH, blocker: true, tool: BROWSER_TOOL },
    ]);
  });

  it("with the blocker off, changes the original exactly as a disk tool would, and warns", () => {
    const state = caseState({ blocker: false });
    const opened = browseImage(state, DEVICE_PATH, CASE_NOW);
    if (!opened.ok) throw new Error("expected the drive to open");
    const changed = opened.value.state.evidence?.images[DEVICE_PATH];
    if (!changed) throw new Error("expected the device to still be attached");
    expect(opened.value.view.image).toBe(changed);
    expect(opened.value.view.record(RECORDS.invoice0412)?.times.a).toBe(CASE_NOW);
    // Deleted records can't be opened by the operating system, so they keep their times.
    expect(opened.value.view.record(RECORDS.invoice0413)?.times.a).not.toBe(CASE_NOW);
    expect(imageHash("sha256", changed)).not.toBe(formSha256());
    expect(opened.value.warning?.[0]).toContain("the write-blocker is off");
    expect(opened.value.events[0]).toMatchObject({ blocker: false, tool: BROWSER_TOOL });

    // The terminal's `lsfs` on the same state and clock leaves the drive in the same place.
    const viaTool = runCase(state, "lsfs", DEVICE_PATH);
    expect(viaTool.state.evidence?.images[DEVICE_PATH]).toEqual(changed);
  });

  it("opens a working copy without touching the original", () => {
    const acquired = runCase(caseState(), "acquire", DEVICE_PATH, "--out", IMAGE_PATH).state;
    const opened = browseImage(acquired, IMAGE_PATH, CASE_NOW);
    if (!opened.ok) throw new Error("expected the copy to open");
    expect(opened.value.events).toEqual([]);
    expect(opened.value.state).toBe(acquired);
  });

  it("fails with the tools' own errors", () => {
    const missing = browseImage(caseState(), "/dev/evidence/qf-lt-99", CASE_NOW);
    expect(missing.ok ? undefined : missing.error.code).toBe("NOT_EVIDENCE");
    const bare = browseImage(bareState(), DEVICE_PATH, CASE_NOW);
    expect(bare.ok ? undefined : bare.error.code).toBe("EVIDENCE_NOT_LOADED");
  });
});
