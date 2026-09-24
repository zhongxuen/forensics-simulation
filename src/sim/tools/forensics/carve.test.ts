import { describe, expect, it } from "vitest";
import { sessionFs } from "../../core/session";
import { decodeBase64 } from "../../evidence/base64";
import { imageHash } from "../../evidence/image";
import { carveBytes } from "../../evidence/magic";
import { setBlocker } from "../../evidence/session";
import type { DiskImage } from "../../evidence/types";
import { readFile } from "../../fs/ops";
import type { SimState } from "../../core/types";
import { bytesFromWorkstationText, workstationText } from "./carve";
import {
  CARVE_OUT,
  carveEvidence,
  carveState,
  DEVICE,
  PLANTED,
  runLine,
  STATEMENTS_ZIP,
  SURVIVING,
  INVOICE_0413,
} from "./__fixtures__/carve-logs";
import { bareState, errorCodes, eventTypes, IMAGE_PATH, refs, text } from "./__fixtures__/evidence";

const read = (state: SimState, path: string): string | undefined => {
  const { vfs, ctx } = sessionFs(state, 0);
  const found = readFile(vfs, ctx, path);
  return found.ok ? found.value : undefined;
};

describe("carve", () => {
  it("lists every object in the unallocated space with its offset, type, size and ref", () => {
    const result = runLine(carveState(), "carve qf-lt-07");
    const out = text(result);
    expect(result.exitCode).toBe(0);
    expect(out).toContain(
      "carve (simulated) · qf-lt-07 · unallocated space, 2,048 bytes · pdf, zip, jpg, png",
    );
    expect(out).toMatch(/512 +pdf +512 bytes +nothing: partial +disk:qf-lt-07:carve\/512/);
    expect(out).toMatch(/1024 +zip +215 bytes +end of central directory/);
    expect(out).toContain("4 objects: 3 complete, 1 partial.");
    expect(out).toContain("Carved objects have no name and no timestamps.");
    expect(out).toContain("strings disk:qf-lt-07:carve/512");
    expect(refs(result)).toEqual([
      "disk:qf-lt-07:carve/512",
      "disk:qf-lt-07:carve/1024",
      "disk:qf-lt-07:carve/1536",
      "disk:qf-lt-07:carve/1792",
    ]);
  });

  it("emits one evidence.carved per object, after reading the original through its blocker", () => {
    const result = runLine(carveState(), "carve qf-lt-07");
    expect(eventTypes(result)).toEqual([
      "evidence.readOriginal",
      "evidence.carved",
      "evidence.carved",
      "evidence.carved",
      "evidence.carved",
      "command.run",
    ]);
    expect(result.events[0]).toMatchObject({ blocker: true, tool: "carve" });
    expect(result.events[1]).toEqual({
      type: "evidence.carved",
      image: "qf-lt-07",
      ref: "disk:qf-lt-07:carve/512",
      fileType: "pdf",
      bytes: 512,
      complete: false,
    });
  });

  it("looks only for the types asked for", () => {
    const result = runLine(carveState(), "carve qf-lt-07 --type zip,jpeg");
    expect(refs(result)).toEqual(["disk:qf-lt-07:carve/1024", "disk:qf-lt-07:carve/1536"]);
    expect(text(result)).toContain("· zip, jpg");
    expect(text(result)).toContain("2 objects: 2 complete, 0 partial.");
  });

  it("writes each object out, named by its offset, byte for byte", () => {
    const result = runLine(carveState(), `carve qf-lt-07 --type pdf,zip --out ${CARVE_OUT}`);
    expect(result.exitCode).toBe(0);
    expect(text(result)).toContain(`Written  ${CARVE_OUT}/carve-1024.zip`);
    const zip = read(result.state, `${CARVE_OUT}/carve-1024.zip`);
    expect(bytesFromWorkstationText(zip ?? "")).toEqual(STATEMENTS_ZIP);
    expect(read(result.state, `${CARVE_OUT}/carve-512.pdf`)).toContain("%PDF-1.4");
    expect(eventTypes(result).filter((type) => type === "file.changed")).toHaveLength(2);
    expect(refs(result)).toContain("disk:qf-lt-07:carve/1024");
  });

  it("refuses to write onto the evidence device", () => {
    const result = runLine(carveState(), "carve qf-lt-07 --out /dev/evidence/carved");
    expect(errorCodes(result)).toEqual(["WRITE_TO_EVIDENCE"]);
  });

  it("passes a folder it can't write to straight through, writing nothing", () => {
    const result = runLine(carveState(), "carve qf-lt-07 --out /etc/carved");
    expect(errorCodes(result)).toEqual(["EACCES"]);
  });

  it("says what it looked for when there is nothing to find", () => {
    const disk = { ...(carveEvidence().disks[0] as DiskImage), unallocatedB64: "" };
    const state = carveState();
    const blank: SimState = {
      ...state,
      evidence: {
        ...(state.evidence as NonNullable<SimState["evidence"]>),
        images: { [DEVICE]: disk },
      },
    };
    const nothing = runLine(blank, "carve qf-lt-07");
    expect(text(nothing)).toContain("No file signatures found: this image has no unallocated");
    expect(text(nothing)).toContain("strings qf-lt-07");
    expect(refs(nothing)).toEqual([]);
  });

  it("warns when the original was read with the write-blocker off", () => {
    const off = setBlocker(carveState(), "qf-lt-07", false);
    const result = runLine(off, "carve qf-lt-07");
    expect(text(result)).toContain("Careful: the write-blocker is off");
    expect(result.events[0]).toMatchObject({ type: "evidence.readOriginal", blocker: false });
  });

  it("reads a working copy without touching the original", () => {
    const copied = runLine(carveState(), `acquire ${DEVICE} --out ${IMAGE_PATH}`).state;
    const result = runLine(copied, "carve qf-lt-07");
    expect(eventTypes(result)[0]).toBe("evidence.carved");
    expect(imageHash("sha256", result.state.evidence?.images[DEVICE] as DiskImage)).toBe(
      imageHash("sha256", carveEvidence().disks[0] as DiskImage),
    );
  });

  it("reports every usage problem", () => {
    const codes = (line: string) => errorCodes(runLine(carveState(), line));
    expect(codes("carve")).toEqual(["MISSING_ARGUMENT"]);
    expect(codes("carve qf-lt-07 extra")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("carve qf-lt-07 --type gif")).toEqual(["BAD_ARGUMENT"]);
    expect(codes("carve qf-lt-07 --deep")).toEqual(["BAD_FLAG"]);
    expect(codes("carve qf-lt-99")).toEqual(["NOT_EVIDENCE"]);
    expect(errorCodes(runLine(bareState(), "carve qf-lt-07"))).toEqual(["EVIDENCE_NOT_LOADED"]);
  });
});

describe("carving, differentially", () => {
  // docs/plan/07 §Spec: every carved object is byte-identical to what the builder planted.
  const space = decodeBase64((carveEvidence().disks[0] as DiskImage).unallocatedB64);
  const carved = carveBytes(space);

  it("finds exactly the objects that were planted, at the offsets they were planted", () => {
    expect(carved.map(({ offset, type, complete }) => ({ offset, type, complete }))).toEqual(
      PLANTED.map(({ offset, type, complete }) => ({ offset, type, complete })),
    );
  });

  it.each(PLANTED.filter((planted) => planted.complete).map((p) => [p.type, p] as const))(
    "carves the %s byte for byte",
    (_, planted) => {
      const object = carved.find((found) => found.offset === planted.offset);
      expect(object?.bytes).toEqual(planted.bytes);
    },
  );

  it("carves the partial PDF as what survived, then whatever was written after it", () => {
    const planted = PLANTED.find((p) => !p.complete);
    const object = carved.find((found) => found.offset === planted?.offset);
    expect(object?.bytes.slice(0, planted?.bytes.length)).toEqual(planted?.bytes);
    expect(workstationText(object?.bytes.slice(0, SURVIVING) ?? new Uint8Array())).toBe(
      INVOICE_0413.slice(0, SURVIVING),
    );
    expect(workstationText(object?.bytes ?? new Uint8Array())).toContain("19:44:10 sync started");
  });

  it("writes out, through the tool, the same bytes the builder planted", () => {
    const result = runLine(carveState(), `carve qf-lt-07 --out ${CARVE_OUT}`);
    for (const planted of PLANTED.filter((p) => p.complete)) {
      const path = `${CARVE_OUT}/carve-${planted.offset}.${planted.type}`;
      expect(bytesFromWorkstationText(read(result.state, path) ?? ""), path).toEqual(planted.bytes);
    }
  });
});

describe("workstation text", () => {
  it("round-trips every byte value", () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(bytesFromWorkstationText(workstationText(all))).toEqual(all);
  });

  it("reads ordinary text with wide characters as UTF-8", () => {
    expect(bytesFromWorkstationText("→")).toEqual(Uint8Array.of(0xe2, 0x86, 0x92));
  });
});
