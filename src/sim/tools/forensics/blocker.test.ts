import { describe, expect, it } from "vitest";
import {
  bareState,
  caseState,
  DEVICE_PATH,
  errorCodes,
  runCase,
  text,
} from "./__fixtures__/evidence";

describe("blocker", () => {
  it("lists every attached device, what it is, and whether its blocker is on", () => {
    const result = runCase(caseState(), "blocker");
    expect(text(result)).toContain("write-blockers on this workstation");
    expect(text(result)).toMatch(/\/dev\/evidence\/qf-lt-07\s+on\s+Fenwold M2 solid-state drive/);
    expect(result.exitCode).toBe(0);
  });

  it("turns one off, and says what that now means", () => {
    const result = runCase(caseState(), "blocker", "off", DEVICE_PATH);
    expect(result.state.evidence?.attached["qf-lt-07"]?.blocker).toBe(false);
    expect(text(result)).toContain("write-blocker OFF for /dev/evidence/qf-lt-07");
    expect(text(result)).toContain("Put it back with: blocker on /dev/evidence/qf-lt-07");
  });

  it("turns one back on, by its device name or its id", () => {
    const off = runCase(caseState(), "blocker", "off", DEVICE_PATH);
    const on = runCase(off.state, "blocker", "on", "qf-lt-07");
    expect(on.state.evidence?.attached["qf-lt-07"]?.blocker).toBe(true);
    expect(text(on)).toContain("Reads of this drive go through the blocker again");
  });

  it("reports a device it doesn't have, a word that isn't on or off, and a missing name", () => {
    expect(errorCodes(runCase(caseState(), "blocker", "on", "qf-lt-99"))).toEqual(["NOT_EVIDENCE"]);
    expect(errorCodes(runCase(caseState(), "blocker", "maybe", DEVICE_PATH))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(errorCodes(runCase(caseState(), "blocker", "off"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(runCase(caseState(), "blocker", "on", DEVICE_PATH, "extra"))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(errorCodes(runCase(caseState(), "blocker", "--quiet"))).toEqual(["BAD_FLAG"]);
  });

  it("says so when no evidence is attached to this workstation", () => {
    const result = runCase(bareState(), "blocker");
    expect(errorCodes(result)).toEqual(["EVIDENCE_NOT_LOADED"]);
    expect(result.exitCode).toBe(1);
  });
});
