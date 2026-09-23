import { describe, expect, it } from "vitest";
import {
  bareState,
  caseState,
  errorCodes,
  refs,
  RECORDS,
  runCase,
  text,
} from "./__fixtures__/evidence";

const look = (record: number, ...rest: string[]) =>
  runCase(caseState(), "inode", "qf-lt-07", String(record), ...rest);

describe("inode", () => {
  it("shows the path, owner, size, clusters and all four MACB times", () => {
    const out = text(look(RECORDS.invoice0413));
    expect(out).toContain("inode (simulated) · qf-lt-07 · record 51");
    expect(out).toContain("Path        C:\\Users\\dana\\Documents\\inv-0413.pdf");
    expect(out).toContain("Owner       dana");
    expect(out).toContain("Size        72 bytes");
    expect(out).toContain("Deleted     yes");
    expect(out).toContain("Clusters    1002-1003 (2 of 4,096 bytes)");
    expect(out).toContain("M modified 2026-04-11T19:41:02Z");
    expect(out).toContain("C changed  2026-04-11T19:42:03Z");
    expect(out).toContain("B born     2026-04-10T16:41:00Z");
  });

  it("puts the record's ref on the lines that name it", () => {
    expect(refs(look(RECORDS.invoice0413))).toEqual([
      "disk:qf-lt-07:mft/51",
      "disk:qf-lt-07:mft/51",
    ]);
    expect(text(look(RECORDS.invoice0413))).toContain("Ref         disk:qf-lt-07:mft/51");
  });

  it("says a deleted record's clusters are untouched, and how to write the content out", () => {
    const out = text(look(RECORDS.invoice0413));
    expect(out).toContain("Reused      no: nothing has been written over those clusters yet");
    expect(out).toContain("recover qf-lt-07 51 --out <path>");
  });

  it("says when a live file has taken those clusters, and names it", () => {
    const out = text(look(RECORDS.note));
    expect(out).toContain("Reused      yes: 1004 holds something else now");
    expect(out).toContain("C:\\Windows\\Temp\\sync.log (record 60) has them");
    expect(out).toContain("Deleting a file only frees its clusters");
  });

  it("says nothing about recovery for a record that was never deleted", () => {
    const out = text(look(RECORDS.invoice0412));
    expect(out).toContain("Deleted     no");
    expect(out).not.toContain("Reused");
  });

  it("notes the drive's own zone beside UTC, and switches with --zone local", () => {
    expect(text(look(RECORDS.invoice0413))).toContain(
      "The machine this drive came from showed Europe/London (+01:00)",
    );
    const local = text(look(RECORDS.invoice0413, "--zone", "local"));
    expect(local).toContain("Times (Europe/London)");
    expect(local).toContain("M modified 2026-04-11 20:41:02 +01:00");
    expect(local).not.toContain("Pass --zone local");
  });

  it("describes a folder record without a size or a cluster count", () => {
    const documents = runCase(caseState(), "lsfs", "qf-lt-07", "C:\\Users\\dana");
    expect(text(documents)).toContain("Documents\\");
    const out = text(look(8));
    expect(out).toContain("Kind        folder");
    expect(out).toContain("Size        -");
    expect(out).toContain("Clusters    none");
  });

  it("reports a record that isn't there, a record number that isn't one, and the rest", () => {
    expect(errorCodes(look(999))).toEqual(["RECORD_NOT_FOUND"]);
    expect(errorCodes(runCase(caseState(), "inode", "qf-lt-07", "fifty"))).toEqual([
      "BAD_ARGUMENT",
    ]);
    expect(errorCodes(runCase(caseState(), "inode"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(runCase(caseState(), "inode", "qf-lt-07"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(runCase(caseState(), "inode", "qf-lt-99", "51"))).toEqual(["NOT_EVIDENCE"]);
    expect(errorCodes(look(51, "extra"))).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(look(51, "--zone", "Mars/Olympus"))).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(look(51, "--deep"))).toEqual(["BAD_FLAG"]);
  });

  it("says so when no evidence is attached", () => {
    expect(errorCodes(runCase(bareState(), "inode", "qf-lt-07", "51"))).toEqual([
      "EVIDENCE_NOT_LOADED",
    ]);
  });
});
