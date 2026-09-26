import { describe, expect, it } from "vitest";
import { utf8Bytes } from "../../evidence/bytes";
import { decodeBase64 } from "../../evidence/base64";
import { imageBytes } from "../../evidence/image";
import { setBlocker } from "../../evidence/session";
import type { DiskImage } from "../../evidence/types";
import { findStrings, imageSpans, memoryStrings, stringLines } from "./strings";
import { CARVE_OUT, carveEvidence, carveState, runLine } from "./__fixtures__/carve-logs";
import { bareState, errorCodes, eventTypes, refs, text } from "./__fixtures__/evidence";

const disk = () => carveEvidence().disks[0] as DiskImage;

/** The printed strings: every line between the banner's blank line and the summary's. */
const printed = (result: ReturnType<typeof runLine>) => {
  const lines = result.output.map((line) => line.text);
  return lines.slice(2, lines.lastIndexOf("") < 2 ? undefined : lines.lastIndexOf(""));
};

describe("findStrings", () => {
  it("finds runs of printable ASCII at least n long, with their offsets", () => {
    const bytes = utf8Bytes("\0\0abc\0hello\tworld\x01xy\0");
    expect(findStrings(bytes, 4)).toEqual([{ offset: 6, text: "hello\tworld", wide: false }]);
    expect(findStrings(bytes, 2).map((run) => run.text)).toEqual(["abc", "hello\tworld", "xy"]);
  });

  it("finds UTF-16LE text, the way Windows stores it", () => {
    const wide = Uint8Array.from([..."C:\\Temp"].flatMap((char) => [char.charCodeAt(0), 0]));
    const bytes = new Uint8Array([0xff, ...wide, 0xff]);
    expect(findStrings(bytes, 4)).toEqual([{ offset: 1, text: "C:\\Temp", wide: true }]);
  });

  it("finds a run that reaches the very end", () => {
    expect(findStrings(utf8Bytes("\0tail"), 4)).toEqual([{ offset: 1, text: "tail", wide: false }]);
  });
});

describe("imageSpans", () => {
  // strings points a line at the record it came from, so the spans have to match the real layout.
  it("matches the bytes imageBytes lays down, record by record", () => {
    const image = disk();
    const bytes = imageBytes(image);
    const spans = imageSpans(image);
    expect(spans.length).toBe(bytes.length);
    for (const span of spans.records) {
      const record = image.records.find((r) => r.record === span.record);
      const number = new DataView(bytes.buffer).getUint32(span.start, true);
      expect(number).toBe(span.record);
      const content = decodeBase64(record?.contentB64 ?? "");
      if (content.length === 0) continue;
      const slack = Math.max(
        0,
        (record?.clusters.length ?? 0) * image.clusterSize - content.length,
      );
      const at = span.end - slack - content.length;
      expect(bytes.slice(at, at + content.length)).toEqual(content);
    }
    const space = decodeBase64(image.unallocatedB64);
    expect(bytes.slice(spans.unallocatedStart)).toEqual(space);
  });
});

describe("strings", () => {
  it("reads a carved object by its ref, every line carrying that ref", () => {
    const result = runLine(carveState(), "strings disk:qf-lt-07:carve/512");
    expect(text(result)).toContain(
      "strings (simulated) · disk:qf-lt-07:carve/512 (partial pdf) · 512 bytes · 4 or more characters",
    );
    expect(printed(result)).toContain("%PDF-1.4");
    expect(printed(result)).toContain("19:44:12 sync finished");
    expect(new Set(refs(result))).toEqual(new Set(["disk:qf-lt-07:carve/512"]));
    expect(refs(result)).toHaveLength(printed(result).length);
  });

  it("prints offsets with -o, counted from the start of what was searched", () => {
    const result = runLine(carveState(), "strings -o disk:qf-lt-07:carve/1024");
    // A stored ZIP entry's name runs straight into its content: they are neighbouring bytes.
    expect(printed(result)[0]).toBe("     30  statements-april.csvdate,reference,amount");
  });

  it("points each string on a disk image at the record or carved object it sits in", () => {
    const result = runLine(carveState(), "strings qf-lt-07");
    const lines = result.output;
    const refOf = (needle: string) => lines.find((line) => line.text.includes(needle))?.ref;
    expect(refOf("invoice 0412")).toBe("disk:qf-lt-07:mft/42");
    expect(refOf("C:\\Windows\\Temp\\sync.log")).toBe("disk:qf-lt-07:mft/60");
    expect(refOf("Thursday run")).toBe("disk:qf-lt-07:mft/51"); // the record still holds it all
    expect(refOf("yard gate camera 2")).toBe("disk:qf-lt-07:carve/1536");
    expect(refOf("wuauclt")).toBeUndefined(); // free space that is no known file
    expect(refOf("CWIMAGE1")).toBeUndefined(); // the image's own header
  });

  it("reads one file record by its ref, deleted or not", () => {
    const result = runLine(carveState(), "strings disk:qf-lt-07:mft/51");
    expect(text(result)).toContain("inv-0413.pdf, deleted");
    expect(printed(result)).toContain("%%EOF");
    expect(new Set(refs(result))).toEqual(new Set(["disk:qf-lt-07:mft/51"]));
    expect(errorCodes(runLine(carveState(), "strings disk:qf-lt-07:mft/999"))).toEqual([
      "RECORD_NOT_FOUND",
    ]);
  });

  it("gives a memory string the ref of the process that owned it, when that is known", () => {
    const result = runLine(carveState(), "strings qf-srv-01-mem");
    expect(printed(result)).toEqual([
      "Quillfen Freight dispatch",
      "cdn-sync.example  (pid 4120, svchost.exe)",
      "203.0.113.47:443  (pid 4120, svchost.exe)",
      "C:\\Users\\dispatch\\Desktop\\routes.xlsx  (pid 2208, explorer.exe)",
    ]);
    expect(refs(result)).toEqual([
      "mem:qf-srv-01-mem:pid/4120",
      "mem:qf-srv-01-mem:pid/4120",
      "mem:qf-srv-01-mem:pid/2208",
    ]);
    expect(text(result)).toContain("5 strings in the capture");
  });

  it("lets -n choose the shortest run", () => {
    expect(printed(runLine(carveState(), "strings -n 3 qf-srv-01-mem"))).toContain(
      "rdp  (pid 4120, svchost.exe)",
    );
    expect(printed(runLine(carveState(), "strings -n 20 qf-srv-01-mem"))).toEqual([
      "Quillfen Freight dispatch",
      "C:\\Users\\dispatch\\Desktop\\routes.xlsx  (pid 2208, explorer.exe)",
    ]);
  });

  it("scopes memory strings to one pid, for mem strings (file 08)", () => {
    const image = carveEvidence().memory[0];
    expect(image && memoryStrings(image, 4, { pid: 2208 }).map((found) => found.text)).toEqual([
      "C:\\Users\\dispatch\\Desktop\\routes.xlsx",
    ]);
    expect(stringLines([{ offset: 5, text: "x" }], true)[0]?.text).toBe("      5  x");
  });

  it("reads a file on the workstation, such as one carve wrote, at the same offsets", () => {
    const carved = runLine(carveState(), `carve qf-lt-07 --type zip --out ${CARVE_OUT}`).state;
    const fromFile = runLine(carved, `strings -o ${CARVE_OUT}/carve-1024.zip`);
    const fromRef = runLine(carved, "strings -o disk:qf-lt-07:carve/1024");
    expect(printed(fromFile)).toEqual(printed(fromRef));
    expect(refs(fromFile)).toEqual([]);
    expect(fromFile.events[0]).toEqual({
      type: "evidence.searched",
      target: `${CARVE_OUT}/carve-1024.zip`,
      kind: "file",
      found: printed(fromFile).length,
    });
  });

  it("emits evidence.searched, and reads an original through its blocker", () => {
    const result = runLine(carveState(), "strings qf-lt-07");
    expect(eventTypes(result)).toEqual([
      "evidence.readOriginal",
      "evidence.searched",
      "command.run",
    ]);
    expect(result.events[1]).toMatchObject({ target: "qf-lt-07", kind: "disk" });
    const off = runLine(setBlocker(carveState(), "qf-lt-07", false), "strings qf-lt-07");
    expect(text(off)).toContain("Careful: the write-blocker is off");
  });

  it("says so when nothing is long enough", () => {
    const result = runLine(carveState(), "strings -n 999 qf-srv-01-mem");
    expect(text(result)).toContain("No runs of 999 or more readable characters.");
  });

  it("reports every usage problem", () => {
    const codes = (line: string) => errorCodes(runLine(carveState(), line));
    expect(codes("strings")).toEqual(["MISSING_ARGUMENT"]);
    expect(codes("strings qf-lt-07 extra")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("strings -n four qf-lt-07")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("strings -n 0 qf-lt-07")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("strings -x qf-lt-07")).toEqual(["BAD_FLAG"]);
    expect(codes("strings disk:qf-lt-07:carve/513")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("strings log:security/3")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("strings qf-lt-99")).toEqual(["NOT_EVIDENCE"]);
    expect(codes("strings /home/examiner/nope.txt")).toEqual(["ENOENT"]);
    expect(errorCodes(runLine(bareState(), "strings qf-lt-07"))).toEqual(["EVIDENCE_NOT_LOADED"]);
    expect(errorCodes(runLine(bareState(), "strings disk:qf-lt-07:carve/512"))).toEqual([
      "EVIDENCE_NOT_LOADED",
    ]);
  });

  it("works on a workstation file with no evidence attached", () => {
    const result = runLine(bareState(), "strings /home/examiner/cases/case-01/handover.txt");
    expect(printed(result)).toEqual(["Signed by Theo Ashgrove. One laptop drive, qf-lt-07."]);
  });
});
