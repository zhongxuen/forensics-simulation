import { describe, expect, it } from "vitest";
import { imageHash } from "../../evidence/image";

import {
  bareState,
  caseState,
  CASE_DIR,
  DEVICE_PATH,
  errorCodes,
  eventTypes,
  formSha256,
  IMAGE_PATH,
  runCase,
  text,
} from "./__fixtures__/evidence";

const acquireIt = (blocker = true) =>
  runCase(caseState({ blocker }), "acquire", DEVICE_PATH, "--out", IMAGE_PATH);

describe("acquire", () => {
  it("images the device, reports progress in sectors, and prints both hashes", () => {
    const result = acquireIt();
    const out = text(result);
    expect(out).toContain(`${DEVICE_PATH} → ${IMAGE_PATH}`);
    expect(out).toContain(
      "Source         qf-lt-07 · Fenwold M2 solid-state drive · serial FW-2291-0067",
    );
    expect(out).toContain("Geometry       2,048 sectors of 512 bytes");
    expect(out).toContain("Write-blocker  on");
    expect(out).toContain("[####################] 2,048 of 2,048 sectors");
    expect(out).toContain(`SHA-256  ${formSha256()}`);
    expect(out).toMatch(/MD5 {6}[0-9a-f]{32}/);
    expect(result.exitCode).toBe(0);
  });

  it("writes a working copy the other tools can read, and says what it is", () => {
    const result = acquireIt();
    const copy = result.state.evidence?.images[IMAGE_PATH];
    expect(copy?.id).toBe("qf-lt-07");
    expect(imageHash("sha256", copy as NonNullable<typeof copy>)).toBe(formSha256());
    // The file left behind explains itself, rather than being a screenful of bytes.
    expect(text(runCase(result.state, "cat", IMAGE_PATH))).toContain("Disk image of qf-lt-07");
    expect(text(runCase(result.state, "lsfs", "qf-lt-07"))).toContain(
      "lsfs (simulated) · qf-lt-07",
    );
  });

  it("emits evidence.readOriginal and evidence.acquired", () => {
    const result = acquireIt();
    expect(eventTypes(result)).toEqual([
      "evidence.readOriginal",
      "file.changed",
      "evidence.acquired",
      "command.run",
    ]);
    expect(result.events[0]).toEqual({
      type: "evidence.readOriginal",
      device: DEVICE_PATH,
      blocker: true,
      tool: "acquire",
    });
    expect(result.events[2]).toMatchObject({
      type: "evidence.acquired",
      device: DEVICE_PATH,
      image: IMAGE_PATH,
      sectors: 2048,
      sha256: formSha256(),
    });
  });

  it("warns, but does not refuse, when the write-blocker is off", () => {
    const result = acquireIt(false);
    expect(result.exitCode).toBe(0);
    expect(text(result)).toContain("Write-blocker  off");
    expect(text(result)).toContain("Careful: the write-blocker is off");
    // The copy carries the new access times, so it no longer matches the handover form.
    expect(text(result)).not.toContain(formSha256());
    expect(result.events[0]).toMatchObject({ type: "evidence.readOriginal", blocker: false });
  });

  it("refuses to write onto the evidence device, in plain words", () => {
    const result = runCase(caseState(), "acquire", DEVICE_PATH, "--out", "/dev/evidence/copy.img");
    expect(errorCodes(result)).toEqual(["WRITE_TO_EVIDENCE"]);
    expect(text(result)).toContain("refusing to write onto the evidence device");
    expect(result.state.evidence?.images["/dev/evidence/copy.img"]).toBeUndefined();
  });

  it("reports a missing device, a missing --out, a name it doesn't know, and extra words", () => {
    expect(errorCodes(runCase(caseState(), "acquire"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(runCase(caseState(), "acquire", DEVICE_PATH))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(runCase(caseState(), "acquire", "qf-lt-99", "--out", IMAGE_PATH))).toEqual([
      "NOT_EVIDENCE",
    ]);
    expect(
      errorCodes(runCase(caseState(), "acquire", DEVICE_PATH, "extra", "--out", IMAGE_PATH)),
    ).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(runCase(caseState(), "acquire", DEVICE_PATH, "--fast"))).toEqual([
      "BAD_FLAG",
    ]);
  });

  it("passes a filesystem failure straight through", () => {
    const result = runCase(caseState(), "acquire", DEVICE_PATH, "--out", "/etc/qf-lt-07.img");
    expect(errorCodes(result)).toEqual(["EACCES"]);
  });

  it("says so when no evidence is attached", () => {
    expect(errorCodes(runCase(bareState(), "acquire", DEVICE_PATH, "--out", IMAGE_PATH))).toEqual([
      "EVIDENCE_NOT_LOADED",
    ]);
  });

  it("can image a working copy again, which changes nothing on the original", () => {
    const first = acquireIt();
    const again = runCase(
      first.state,
      "acquire",
      IMAGE_PATH,
      "--out",
      `${CASE_DIR}/images/two.img`,
    );
    expect(again.exitCode).toBe(0);
    expect(eventTypes(again)).not.toContain("evidence.readOriginal");
    expect(text(again)).toContain("not a device: this is already a copy");
  });
});
