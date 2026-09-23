import { describe, expect, it } from "vitest";
import {
  bareState,
  caseState,
  CASE_DIR,
  DEVICE_PATH,
  errorCodes,
  eventTypes,
  refs,
  RECORDS,
  runCase,
  text,
} from "./__fixtures__/evidence";

const OUT = `${CASE_DIR}/export/inv-0413.pdf`;

const recoverIt = (record: number, out = OUT) =>
  runCase(caseState(), "recover", "qf-lt-07", String(record), "--out", out);

describe("recover", () => {
  it("writes a deleted file's content out while its clusters are untouched", () => {
    const result = recoverIt(RECORDS.invoice0413);
    const out = text(result);
    expect(out).toContain(`recover (simulated) · qf-lt-07 · record 51 → ${OUT}`);
    expect(out).toContain("From      C:\\Users\\dana\\Documents\\inv-0413.pdf (deleted)");
    expect(out).toContain("Clusters  1002-1003, none reused");
    expect(out).toContain("Written   72 bytes");
    expect(out).toMatch(/SHA-256 {3}[0-9a-f]{64}/);
    expect(result.exitCode).toBe(0);
    expect(text(runCase(result.state, "cat", OUT))).toContain("invoice 0413");
  });

  it("puts the record's ref on the line that names it, and in the event", () => {
    const result = recoverIt(RECORDS.invoice0413);
    expect(refs(result)).toEqual(["disk:qf-lt-07:mft/51"]);
    expect(eventTypes(result)).toEqual([
      "evidence.readOriginal",
      "file.changed",
      "evidence.recovered",
      "command.run",
    ]);
    expect(result.events[2]).toEqual({
      type: "evidence.recovered",
      image: "qf-lt-07",
      record: 51,
      path: OUT,
      ref: "disk:qf-lt-07:mft/51",
      bytes: 72,
    });
  });

  it("refuses when something has been written over the clusters, and explains why", () => {
    const result = recoverIt(RECORDS.note, `${CASE_DIR}/export/note.txt`);
    expect(errorCodes(result)).toEqual(["CLUSTERS_REUSED"]);
    expect(result.exitCode).toBe(1);
    const out = text(result);
    expect(out).toContain("those clusters hold something else now");
    expect(out).toContain("C:\\Windows\\Temp\\sync.log has since been written there");
    expect(out).toContain("inode qf-lt-07 55 shows the name");
    // Nothing was written: half a file would look like a whole one.
    expect(errorCodes(runCase(result.state, "cat", `${CASE_DIR}/export/note.txt`))).toEqual([
      "ENOENT",
    ]);
  });

  it("copies a live record out too, which is how you take a file to another tool", () => {
    const result = recoverIt(RECORDS.invoice0412, `${CASE_DIR}/export/inv-0412.pdf`);
    expect(result.exitCode).toBe(0);
    expect(text(result)).toContain("From      C:\\Users\\dana\\Documents\\inv-0412.pdf\n");
  });

  it("refuses to write onto the evidence device", () => {
    const result = recoverIt(RECORDS.invoice0413, "/dev/evidence/inv-0413.pdf");
    expect(errorCodes(result)).toEqual(["WRITE_TO_EVIDENCE"]);
  });

  it("reports a record that isn't there, a folder, and every missing argument", () => {
    expect(errorCodes(recoverIt(999))).toEqual(["RECORD_NOT_FOUND"]);
    expect(errorCodes(recoverIt(8))).toEqual(["BAD_ARGUMENT"]); // C:\Users\dana\Documents
    expect(errorCodes(runCase(caseState(), "recover"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(runCase(caseState(), "recover", "qf-lt-07"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(runCase(caseState(), "recover", "qf-lt-07", "51"))).toEqual([
      "MISSING_ARGUMENT",
    ]);
    expect(errorCodes(runCase(caseState(), "recover", "qf-lt-07", "fifty", "--out", OUT))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(errorCodes(runCase(caseState(), "recover", "qf-lt-99", "51", "--out", OUT))).toEqual([
      "NOT_EVIDENCE",
    ]);
    expect(
      errorCodes(runCase(caseState(), "recover", "qf-lt-07", "51", "extra", "--out", OUT)),
    ).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(runCase(caseState(), "recover", "qf-lt-07", "51", "--deep"))).toEqual([
      "BAD_FLAG",
    ]);
  });

  it("passes a filesystem failure straight through", () => {
    expect(errorCodes(recoverIt(RECORDS.invoice0413, "/etc/inv-0413.pdf"))).toEqual(["EACCES"]);
  });

  it("warns when the original was read with the write-blocker off", () => {
    const off = runCase(caseState(), "blocker", "off", DEVICE_PATH).state;
    const result = runCase(off, "recover", "qf-lt-07", "51", "--out", OUT);
    expect(result.exitCode).toBe(0);
    expect(text(result)).toContain("Careful: the write-blocker is off");
    expect(result.events[0]).toMatchObject({ type: "evidence.readOriginal", blocker: false });
  });

  it("says so when no evidence is attached", () => {
    expect(errorCodes(runCase(bareState(), "recover", "qf-lt-07", "51", "--out", OUT))).toEqual([
      "EVIDENCE_NOT_LOADED",
    ]);
  });
});
