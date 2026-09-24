/**
 * strings: pulls the readable text out of anything, with where each piece was found
 * (docs/plan/07-carve-strings-logq.md).
 *
 * Point it at a disk image, one carved object or file record (by its ref), a memory image, or a
 * file on the workstation. Every line that came from a piece of evidence carries that evidence's
 * ref: the record or carved object it sits in on a disk, the process that owned it in memory.
 */
import { failure, plural, stdout } from "../../core/output";
import type { SimError } from "../../core/errors";
import type { OutputLine, SimResult, SimState } from "../../core/types";
import { decodeBase64 } from "../../evidence/base64";
import { utf8Bytes } from "../../evidence/bytes";
import type { DiskView } from "../../evidence/disk";
import { imageBytes } from "../../evidence/image";
import { carveBytes, carvedObjectAt } from "../../evidence/magic";
import { formatRef, parseRef } from "../../evidence/refs";
import type { EvidenceSession } from "../../evidence/session";
import type { ArtefactRef, DiskImage, MemoryImage } from "../../evidence/types";
import { readFile } from "../../fs/ops";
import { optionValue, parseArgs } from "../args";
import type { Tool, ToolContext } from "../types";
import { bytesFromWorkstationText, carveRef } from "./carve";
import {
  banner,
  delivered,
  findImage,
  flag,
  groupDigits,
  openImage,
  recordRef,
  requireEvidence,
  workstationFs,
} from "./shared";

const NAME = "strings";
const DEFAULT_MIN = 4;
const MAX_MIN = 1000;

/** One run of readable characters. */
export interface StringRun {
  /** Where the run starts, in bytes from the start of what was searched. */
  readonly offset: number;
  readonly text: string;
  /** True for UTF-16LE text: each character followed by a zero byte, the way Windows stores it. */
  readonly wide: boolean;
}

/** A string as the tool prints it: the run, and the evidence it was found in. */
export interface FoundString {
  readonly offset: number;
  readonly text: string;
  readonly ref?: ArtefactRef;
  /** Printed after the text: "pid 4120, svchost.exe". */
  readonly note?: string;
}

const printable = (byte: number | undefined): boolean =>
  byte !== undefined && (byte === 0x09 || (byte >= 0x20 && byte <= 0x7e));

/**
 * Every run of at least `min` printable ASCII characters, and every run of at least `min`
 * UTF-16LE ones, in offset order. Printable means a tab or anything from space to tilde.
 */
export function findStrings(bytes: Uint8Array, min: number): StringRun[] {
  const runs: StringRun[] = [];

  let start = -1;
  for (let i = 0; i <= bytes.length; i++) {
    if (i < bytes.length && printable(bytes[i])) {
      if (start < 0) start = i;
      continue;
    }
    if (start >= 0 && i - start >= min) {
      runs.push({ offset: start, text: ascii(bytes, start, i, 1), wide: false });
    }
    start = -1;
  }

  for (let i = 0; i < bytes.length - 1;) {
    let end = i;
    while (printable(bytes[end]) && bytes[end + 1] === 0 && end + 1 < bytes.length) end += 2;
    const length = (end - i) / 2;
    if (length >= Math.max(min, 2)) {
      runs.push({ offset: i, text: ascii(bytes, i, end, 2), wide: true });
      i = end;
    } else {
      i++;
    }
  }

  return runs.sort((x, y) => x.offset - y.offset || Number(x.wide) - Number(y.wide));
}

function ascii(bytes: Uint8Array, start: number, end: number, step: number): string {
  let text = "";
  for (let i = start; i < end; i += step) text += String.fromCharCode(bytes[i] as number);
  return text;
}

/** Where each part of a disk image's bytes (evidence/image.ts) starts and ends. */
export interface ImageSpans {
  readonly records: readonly {
    readonly record: number;
    readonly start: number;
    readonly end: number;
  }[];
  /** Where the unallocated bytes themselves start, after their length field. */
  readonly unallocatedStart: number;
  readonly length: number;
}

/**
 * The spans of `imageBytes(disk)`, worked out from the same layout without building it twice.
 * `strings.test.ts` checks every span against the real bytes, so a layout change can't make
 * strings point at the wrong record without a test saying so.
 */
export function imageSpans(disk: DiskImage): ImageSpans {
  const text = (value: string) => 4 + utf8Bytes(value).length;
  let at = 8 + 12 + text(disk.id) + text(disk.device.model) + text(disk.device.serial);
  at += 4;
  for (const partition of disk.partitions) at += 4 + text(partition.label) + text(partition.fs) + 8;
  at += 4;
  const records = [...disk.records]
    .sort((x, y) => x.record - y.record)
    .map((record) => {
      const start = at;
      const content = decodeBase64(record.contentB64).length;
      const slack = Math.max(0, record.clusters.length * disk.clusterSize - content);
      at += 4 + text(record.path) + text(record.owner) + 2 + 4 + 32;
      at += 4 + 4 * record.clusters.length + 4 + content + slack;
      return { record: record.record, start, end: at };
    });
  const unallocatedStart = at + 4;
  return {
    records,
    unallocatedStart,
    length: unallocatedStart + decodeBase64(disk.unallocatedB64).length,
  };
}

/** Every string in a disk image, each pointing at the record or carved object it sits in. */
export function diskStrings(disk: DiskImage, min: number): FoundString[] {
  const spans = imageSpans(disk);
  const objects = carveBytes(decodeBase64(disk.unallocatedB64));
  return findStrings(imageBytes(disk), min).map((run) => {
    const record = spans.records.find((span) => run.offset >= span.start && run.offset < span.end);
    if (record) return { ...run, ref: recordRef(disk.id, record.record) };
    const inSpace = run.offset - spans.unallocatedStart;
    const object = objects.find(
      (found) => inSpace >= found.offset && inSpace < found.offset + found.size,
    );
    return object ? { ...run, ref: carveRef(disk.id, object.offset) } : { ...run };
  });
}

/**
 * The strings a memory image holds, each with the process that owned it when that is known.
 * `mem strings` (docs/plan/08-memory-tools.md) is this, scoped to one pid.
 */
export function memoryStrings(
  image: MemoryImage,
  min: number,
  options: { readonly pid?: number } = {},
): FoundString[] {
  const names = new Map(image.processes.map((process) => [process.pid, process.name]));
  return [...image.strings]
    .filter((found) => found.value.length >= min)
    .filter((found) => options.pid === undefined || found.pid === options.pid)
    .sort((x, y) => x.offset - y.offset)
    .map((found) => {
      const name = found.pid === undefined ? undefined : names.get(found.pid);
      if (found.pid === undefined || name === undefined) {
        return { offset: found.offset, text: found.value };
      }
      return {
        offset: found.offset,
        text: found.value,
        ref: formatRef({ kind: "process", image: image.id, pid: found.pid }),
        note: `pid ${found.pid}, ${name}`,
      };
    });
}

/** The lines `strings` prints for what it found: `-o` puts the offset in front, in decimal. */
export function stringLines(found: readonly FoundString[], offsets: boolean): OutputLine[] {
  const width = Math.max(7, ...found.map((item) => String(item.offset).length));
  return found.map((item) => {
    const text =
      (offsets ? `${String(item.offset).padStart(width)}  ` : "") +
      item.text +
      (item.note ? `  (${item.note})` : "");
    return item.ref ? { stream: "stdout", text, ref: item.ref } : stdout(text);
  });
}

type Kind = "disk" | "memory" | "carve" | "file";

const bytesText = (count: number): string =>
  `${groupDigits(count)} ${count === 1 ? "byte" : "bytes"}`;

/** What was searched, and what came out of it. */
interface Searched {
  readonly state: SimState;
  readonly kind: Kind;
  /** For the banner: "qf-lt-07", "disk:qf-lt-07:carve/1024 (partial pdf)". */
  readonly label: string;
  /** How much was searched, for the banner: "2,048 bytes", "5 strings in the capture". */
  readonly extent: string;
  readonly found: readonly FoundString[];
  readonly events: SimResult["events"];
  readonly warning?: readonly string[];
}

export const strings: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner: "pull the readable text out of an image, a carved file or a memory capture.",
    usage: [
      "strings [-n <min>] [-o] <image>",
      "strings [-n <min>] [-o] <ref>",
      "strings [-n <min>] [-o] <memory image | file>",
    ],
    description: [
      "Most of what is stored on a drive or in memory is not text: it is numbers, pictures, compressed data. Mixed in with it are runs of ordinary characters, such as a file name, an address, a line someone typed. strings finds those runs and prints them, one per line.",
      "It prints any run of four or more readable characters, in plain ASCII and in UTF-16, the two-bytes-per-character text Windows uses. -n changes the four, and -o puts each run's offset in front: how many bytes from the start it was found.",
      "Point it at a disk image, a carved object or a file record by its ref (disk:qf-lt-07:carve/1024, disk:qf-lt-07:mft/51), a memory image (qf-srv-01-mem), or a file in your own folders. Lines from evidence carry a ref: the record or carved object they sit in, or in memory the process that owned them.",
      "The output is one line per string, so it pipes well: strings qf-lt-07 | grep invoice.",
    ],
    options: [
      { flags: "-n <min>", text: "The shortest run to print, in characters. Four by default." },
      { flags: "-o", text: "Print each string's offset in front of it, in decimal." },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      {
        command: "strings disk:qf-lt-07:carve/1024",
        text: "The readable text left in one carved object.",
      },
      {
        command: "strings -o qf-lt-07 | grep -i invoice",
        text: "Every mention of an invoice anywhere on the drive, with where it was.",
      },
      {
        command: "strings -n 8 qf-srv-01-mem",
        text: "Longer strings from a memory image, with the process that held each one.",
      },
    ],
    concept: [
      "strings is how an examiner reads something they have no program for: a partial file, a region of memory, an unknown format. Names, addresses, commands and messages survive in places nothing else will show them.",
      "A string on its own proves little. It shows some bytes were there, not who put them there or when. Tie it back to its ref, the record, carved object or process it came from, before it goes in a report.",
    ],
    realWorld: [
      "The strings command in GNU binutils (strings -t d for offsets, -e l for UTF-16LE), and Sysinternals Strings on Windows.",
      "bstrings, which adds regular-expression searches, and Autopsy's keyword search, which extracts strings from unallocated space as it indexes.",
      "For memory, the Volatility 3 approach: run strings over the capture, then map each offset back to its process with the windows.strings plugin.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-n", "--bytes"], key: "min", takesValue: true },
      { names: ["-o"], key: "offsets" },
    ]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [target, extra] = parsed.value.positionals;
    if (target === undefined) {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "image or file" }, state);
    }
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "target", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const minText = optionValue(parsed.value, "min") ?? String(DEFAULT_MIN);
    if (!/^\d{1,4}$/.test(minText)) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "-n", value: minText, reason: "bad-format" },
        state,
      );
    }
    const min = Number(minText);
    if (min < 1 || min > MAX_MIN) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "-n", value: minText, reason: "out-of-range" },
        state,
      );
    }

    const searched = search(state, ctx, target, min);
    if (!searched.ok) return failure(NAME, searched.error, searched.state, searched.events);
    const result = searched.value;

    const output: OutputLine[] = [
      banner(NAME, result.label, result.extent, `${min} or more characters`),
      stdout(""),
      ...stringLines(result.found, flag(parsed.value, "offsets")),
      stdout(""),
      stdout(
        result.found.length === 0
          ? `No runs of ${min} or more readable characters. Try a smaller -n, like -n 3.`
          : `${plural(result.found.length, "string")}.${result.kind === "memory" ? " A pid in brackets is the process that owned the string." : ""}`,
      ),
    ];
    if (result.warning) output.push(stdout(""), ...result.warning.map(stdout));
    return delivered(result.state, [NAME, ...args].join(" "), output, [
      ...result.events,
      { type: "evidence.searched", target, kind: result.kind, found: result.found.length },
    ]);
  },
};

type SearchResult =
  | { readonly ok: true; readonly value: Searched }
  | {
      readonly ok: false;
      readonly error: SimError;
      readonly state: SimState;
      readonly events: SimResult["events"];
    };

const refused = (error: SimError, state: SimState, events: SimResult["events"] = []) =>
  ({ ok: false, error, state, events }) as const;

/** Works out what `target` names and reads the strings out of it. */
function search(state: SimState, ctx: ToolContext, target: string, min: number): SearchResult {
  const fs = workstationFs(state, ctx);
  const session = requireEvidence(state);

  const ref = parseRef(target);
  if (ref) {
    if (!session.ok) return refused(session.error, state);
    if (ref.kind !== "carve" && ref.kind !== "file") {
      return refused(
        { code: "BAD_ARGUMENT", argument: "ref", value: target, reason: "unknown-value" },
        state,
      );
    }
    const image = findImage(session.value, fs.vfs, fs.ctx, ref.image);
    if (!image.ok) return refused(image.error, state);
    const opened = openImage(state, image.value, NAME, ctx.now);
    const inner =
      ref.kind === "carve"
        ? searchCarved(opened.view, ref.offset, target, min)
        : searchRecord(opened.view, ref.record, target, min);
    if (!inner.ok) return refused(inner.error, opened.state, opened.events);
    return {
      ok: true,
      value: {
        ...inner.value,
        state: opened.state,
        events: opened.events,
        ...(opened.warning ? { warning: opened.warning } : {}),
      },
    };
  }

  if (session.ok) {
    const memory = memoryImage(session.value, target);
    if (memory) {
      return {
        ok: true,
        value: {
          state,
          kind: "memory",
          label: `${memory.id} (memory of ${memory.host})`,
          extent: `${plural(memory.strings.length, "string")} in the capture`,
          found: memoryStrings(memory, min),
          events: [],
        },
      };
    }
    const image = findImage(session.value, fs.vfs, fs.ctx, target);
    if (image.ok) {
      const opened = openImage(state, image.value, NAME, ctx.now);
      const disk = opened.view.image;
      return {
        ok: true,
        value: {
          state: opened.state,
          kind: "disk",
          label: disk.id,
          extent: bytesText(imageSpans(disk).length),
          found: diskStrings(disk, min),
          events: opened.events,
          ...(opened.warning ? { warning: opened.warning } : {}),
        },
      };
    }
  }

  const read = readFile(fs.vfs, fs.ctx, target);
  if (!read.ok) {
    if (read.error.code === "ENOENT" && !target.includes("/")) {
      return refused(session.ok ? { code: "NOT_EVIDENCE", name: target } : session.error, state);
    }
    return refused(read.error, state);
  }
  const bytes = bytesFromWorkstationText(read.value);
  return {
    ok: true,
    value: {
      state,
      kind: "file",
      label: target,
      extent: bytesText(bytes.length),
      found: findStrings(bytes, min).map((run) => ({ offset: run.offset, text: run.text })),
      events: [],
    },
  };
}

type Inner =
  | { readonly ok: true; readonly value: Omit<Searched, "state" | "events" | "warning"> }
  | { readonly ok: false; readonly error: SimError };

/** One carved object: offsets count from its first byte, like strings on the file carve --out writes. */
function searchCarved(view: DiskView, offset: number, target: string, min: number): Inner {
  const object = carvedObjectAt(decodeBase64(view.image.unallocatedB64), offset);
  if (!object) {
    return {
      ok: false,
      error: { code: "BAD_ARGUMENT", argument: "ref", value: target, reason: "unknown-value" },
    };
  }
  const ref = carveRef(view.image.id, offset);
  return {
    ok: true,
    value: {
      kind: "carve",
      label: `${ref} (${object.complete ? "" : "partial "}${object.type})`,
      extent: bytesText(object.size),
      found: findStrings(object.bytes, min).map((run) => ({
        offset: run.offset,
        text: run.text,
        ref,
      })),
    },
  };
}

/** One file record's content, deleted or not: offsets count from its first byte. */
function searchRecord(view: DiskView, record: number, target: string, min: number): Inner {
  const file = view.record(record);
  if (!file) {
    return { ok: false, error: { code: "RECORD_NOT_FOUND", image: view.image.id, record } };
  }
  const ref = recordRef(view.image.id, record);
  const bytes = view.content(file);
  return {
    ok: true,
    value: {
      kind: "disk",
      label: `${target} (${file.path}${file.deleted ? ", deleted" : ""})`,
      extent: bytesText(bytes.length),
      found: findStrings(bytes, min).map((run) => ({ offset: run.offset, text: run.text, ref })),
    },
  };
}

/**
 * A memory image by its id ("qf-srv-01-mem"). Never by its host's name: a disk image usually has
 * that name, and a bare name means the disk.
 */
function memoryImage(session: EvidenceSession, name: string): MemoryImage | undefined {
  return session.set.memory.find((image) => image.id === name);
}
