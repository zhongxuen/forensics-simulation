import { describe, expect, it } from "vitest";
import {
  bareState,
  caseState,
  errorCodes,
  refs,
  runCase,
  runAll,
  text,
} from "./__fixtures__/evidence";

const DOCUMENTS = "C:\\Users\\dana\\Documents";

/** A listing, so `pin` has something with refs on it to look back at. */
const listed = () => runCase(caseState(), "lsfs", "qf-lt-07", DOCUMENTS).state;

describe("pin", () => {
  it("pins the last line that named a piece of evidence", () => {
    const result = runCase(listed(), "pin");
    expect(text(result)).toContain("pinned to the case board");
    expect(text(result)).toContain("disk:qf-lt-07:mft/55");
    expect(refs(result)).toEqual(["disk:qf-lt-07:mft/55"]);
    expect(result.exitCode).toBe(0);
  });

  it("emits board.pinned with the ref, the line and the note", () => {
    const result = runCase(listed(), "pin", "5", "-m", "the invoice the office says went missing");
    expect(result.events[0]).toEqual({
      type: "board.pinned",
      ref: "disk:qf-lt-07:mft/51",
      line: "*  51      72    inv-0413.pdf",
      note: "the invoice the office says went missing",
    });
    expect(text(result)).toContain("note  the invoice the office says went missing");
  });

  it("names the command and line it came from, and the other lines you could pin", () => {
    const result = runCase(listed(), "pin", "4");
    expect(text(result)).toContain(`from  lsfs qf-lt-07 ${DOCUMENTS}, line 4`);
    expect(text(result)).toContain("Other lines you can pin from that output: 5, 6.");
  });

  it("pins from inode, and leaves the remembered output alone so a second pin works", () => {
    const { state } = runAll(caseState(), [["inode", "qf-lt-07", "51"]]);
    const first = runCase(state, "pin");
    expect(first.events[0]).toMatchObject({ ref: "disk:qf-lt-07:mft/51" });
    const second = runCase(first.state, "pin", "3");
    expect(second.events[0]).toMatchObject({ ref: "disk:qf-lt-07:mft/51" });
    expect(second.exitCode).toBe(0);
  });

  it("says what a line has to name when the one asked for names nothing", () => {
    const result = runCase(listed(), "pin", "1");
    expect(errorCodes(result)).toEqual(["NOTHING_TO_PIN"]);
    expect(text(result)).toContain("line 1 has nothing to pin");
    expect(result.exitCode).toBe(1);
  });

  it("says so when nothing has been printed yet, and when no line names anything", () => {
    expect(errorCodes(runCase(caseState(), "pin"))).toEqual(["NOTHING_TO_PIN"]);
    const blockers = runCase(caseState(), "blocker").state;
    const result = runCase(blockers, "pin");
    expect(errorCodes(result)).toEqual(["NOTHING_TO_PIN"]);
  });

  it("reports a line number outside the output, a note that is too long, and extra words", () => {
    expect(errorCodes(runCase(listed(), "pin", "999"))).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(runCase(listed(), "pin", "0"))).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(runCase(listed(), "pin", "three"))).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(runCase(listed(), "pin", "-m", "x".repeat(201)))).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(runCase(listed(), "pin", "4", "extra"))).toEqual(["BAD_ARGUMENT"]);
    expect(errorCodes(runCase(listed(), "pin", "--sticky"))).toEqual(["BAD_FLAG"]);
  });

  it("says so when no evidence is attached", () => {
    expect(errorCodes(runCase(bareState(), "pin"))).toEqual(["EVIDENCE_NOT_LOADED"]);
  });
});
