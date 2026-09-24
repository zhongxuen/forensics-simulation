/**
 * `mem malfind`: stretches of memory that are both writable and executable and that no file on
 * disk is behind (docs/plan/08-memory-tools.md).
 *
 * A program's own code is loaded from its file and is executable but not writable while it runs.
 * Memory that can be written *and* run, with no file behind it, is what code written into a
 * process at run time looks like: injected code (MITRE ATT&CK T1055) sits in exactly such a place.
 * So does the output of a just-in-time compiler, the part of a runtime such as .NET or a browser's
 * script engine that turns code into machine instructions while the program runs. The tool finds
 * both and says neither: telling them apart is the examiner's job, and the man page says how.
 */
import { plural, stdout } from "../../../core/output";
import type { OutputLine } from "../../../core/types";
import { decodeBase64 } from "../../../evidence/base64";
import type { MemoryRegion } from "../../../evidence/types";
import { groupDigits } from "../shared";
import {
  hexAddress,
  ownerName,
  refLine,
  regionRef,
  type MemReport,
  type MemRequest,
} from "./shared";

/** How much of each region is shown: the first 64 bytes, as four rows of sixteen. */
export const PREVIEW_BYTES = 64;
const ROW = 16;

/** Whether a region is the kind malfind reports: writable, executable, and backed by no file. */
export const isSuspectRegion = (region: MemoryRegion): boolean =>
  region.protection === "PAGE_EXECUTE_READWRITE" && region.backedBy === undefined;

export function malfind(request: MemRequest): MemReport {
  const { image, pid } = request;
  const found = image.regions
    .filter(isSuspectRegion)
    .filter((region) => pid === undefined || region.pid === pid)
    .sort((x, y) => x.pid - y.pid || x.base - y.base);

  const lines: OutputLine[] = [];
  if (found.length === 0) {
    lines.push(
      stdout(
        pid === undefined
          ? "  (no writable, executable memory without a file behind it)"
          : `  (none in pid ${pid})`,
      ),
      stdout(""),
    );
  }
  for (const region of found) {
    const ref = regionRef(image, region.base);
    lines.push(
      refLine(
        `  ${ownerName(image, region.pid)}  pid ${region.pid}  at ${hexAddress(region.base)}  ${groupDigits(region.size)} bytes`,
        ref,
      ),
      refLine(`  ${region.protection}, private: no file on disk is behind it`, ref),
      ...previewRows(region).map((row) => refLine(`    ${row}`, ref)),
      stdout(""),
    );
  }
  lines.push(
    stdout("Code a program loads from its own file can run but not be changed. Memory that can"),
    stdout("be written and run, with no file behind it, was filled while the program ran: by"),
    stdout("injected code, or by a runtime compiling code as it goes. Which process it is in,"),
    stdout("and what the first bytes are, tell the two apart. man mem says how."),
  );
  return {
    summary: [plural(found.length, "region"), ...(pid === undefined ? [] : [`pid ${pid}`])],
    lines,
    event: {
      type: "memory.scanned",
      image: image.id,
      view: "malfind",
      found: found.length,
      ...(pid === undefined ? {} : { pid }),
    },
  };
}

/** The first bytes of a region as address, hex and printable text, sixteen bytes a row. */
export function previewRows(region: MemoryRegion): readonly string[] {
  const bytes = decodeBase64(region.previewB64).subarray(0, PREVIEW_BYTES);
  if (bytes.length === 0) return ["(no bytes captured for this region)"];
  const rows: string[] = [];
  for (let start = 0; start < bytes.length; start += ROW) {
    const chunk = [...bytes.subarray(start, start + ROW)];
    const hex = chunk.map((byte) => byte.toString(16).padStart(2, "0"));
    const left = hex.slice(0, 8).join(" ");
    const right = hex.slice(8).join(" ");
    const text = chunk
      .map((byte) => (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : "."))
      .join("");
    rows.push(
      `${hexAddress(region.base + start)}  ${`${left}  ${right}`.padEnd(ROW * 3)}  ${text}`,
    );
  }
  return rows;
}
