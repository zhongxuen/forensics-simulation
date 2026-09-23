import { describe, expect, it } from "vitest";
import {
  bareState,
  caseState,
  DEVICE_PATH,
  errorCodes,
  eventTypes,
  IMAGE_PATH,
  refs,
  RECORDS,
  runCase,
  text,
} from "./__fixtures__/evidence";

const DOCUMENTS = "C:\\Users\\dana\\Documents";

describe("lsfs", () => {
  it("lists the top of the drive when no path is given", () => {
    const result = runCase(caseState(), "lsfs", "qf-lt-07");
    expect(text(result)).toContain("lsfs (simulated) · qf-lt-07 · C:\\ · 2 records");
    expect(text(result)).toMatch(/Users\\/);
    expect(text(result)).toMatch(/Windows\\/);
    expect(result.exitCode).toBe(0);
  });

  it("lists one folder, marking deleted records with a *", () => {
    const result = runCase(caseState(), "lsfs", "qf-lt-07", DOCUMENTS);
    const out = text(result);
    expect(out).toContain("3 records, 2 deleted");
    expect(out).toMatch(/ {5}42 +61 +inv-0412\.pdf/);
    expect(out).toMatch(/\* {2}51 +72 +inv-0413\.pdf/);
    expect(out).toContain("* marks a deleted record");
  });

  it("puts a ref on every record line, and on no other line", () => {
    const result = runCase(caseState(), "lsfs", "qf-lt-07", DOCUMENTS);
    expect(refs(result)).toEqual([
      `disk:qf-lt-07:mft/${RECORDS.invoice0412}`,
      `disk:qf-lt-07:mft/${RECORDS.invoice0413}`,
      `disk:qf-lt-07:mft/${RECORDS.note}`,
    ]);
  });

  it("walks the whole drive with -r, and shows deleted records only with -d", () => {
    const all = runCase(caseState(), "lsfs", "qf-lt-07", "-r");
    expect(text(all)).toContain("9 records, 2 deleted");
    expect(text(all)).toContain("Windows\\Temp\\sync.log");
    const deleted = runCase(caseState(), "lsfs", "qf-lt-07", "-rd");
    expect(text(deleted)).toContain("2 records, deleted only");
    expect(text(deleted)).not.toContain("inv-0412.pdf");
  });

  it("shows the record number, size, owner and all four MACB times with -l, in UTC", () => {
    const result = runCase(caseState(), "lsfs", "qf-lt-07", DOCUMENTS, "-l");
    expect(text(result)).toContain("times in UTC");
    expect(text(result)).toContain("RECORD  SIZE  OWNER  M");
    expect(text(result)).toContain("2026-04-11T19:41:02Z");
    expect(text(result)).toContain("dana");
  });

  it("shows the drive's own local time with --zone local", () => {
    const result = runCase(caseState(), "lsfs", "qf-lt-07", DOCUMENTS, "-l", "--zone", "local");
    expect(text(result)).toContain("times in Europe/London");
    expect(text(result)).toContain("2026-04-11 20:41:02 +01:00");
  });

  it("reads the working copy once one exists, and the original before that", () => {
    const original = runCase(caseState(), "lsfs", "qf-lt-07");
    expect(eventTypes(original)).toContain("evidence.readOriginal");
    const acquired = runCase(caseState(), "acquire", DEVICE_PATH, "--out", IMAGE_PATH).state;
    const copy = runCase(acquired, "lsfs", "qf-lt-07");
    expect(eventTypes(copy)).toEqual(["command.run"]);
  });

  it("reports a name it doesn't know, a folder that isn't there, and a zone it can't show", () => {
    expect(errorCodes(runCase(caseState(), "lsfs"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(runCase(caseState(), "lsfs", "qf-lt-99"))).toEqual(["NOT_EVIDENCE"]);
    expect(errorCodes(runCase(caseState(), "lsfs", "qf-lt-07", "D:\\Nowhere"))).toEqual(["ENOENT"]);
    expect(errorCodes(runCase(caseState(), "lsfs", "qf-lt-07", "--zone", "Mars/Olympus"))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(errorCodes(runCase(caseState(), "lsfs", "qf-lt-07", DOCUMENTS, "extra"))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(errorCodes(runCase(caseState(), "lsfs", "qf-lt-07", "-z"))).toEqual(["BAD_FLAG"]);
  });

  it("says a folder with nothing in it is empty rather than printing nothing", () => {
    const result = runCase(caseState(), "lsfs", "qf-lt-07", "C:\\Windows\\Temp", "-d");
    expect(text(result)).toContain("(no records here)");
  });

  it("says so when no evidence is attached", () => {
    expect(errorCodes(runCase(bareState(), "lsfs", "qf-lt-07"))).toEqual(["EVIDENCE_NOT_LOADED"]);
  });
});
