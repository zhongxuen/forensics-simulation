/**
 * lsfs: lists the file records inside a disk image, deleted ones included.
 *
 * A file system keeps a table of records, one per file and folder: where its content sits, how big
 * it is, who owns it, and four times. Deleting a file marks its record free and leaves the rest
 * where it is, which is why a listing of the records shows more than a listing of the folders
 * would (docs/plan/04-disk-tools.md).
 */
import { columns, failure, plural, stdout } from "../../core/output";
import type { OutputLine } from "../../core/types";
import { baseName, type DiskView } from "../../evidence/disk";
import type { FileRecord } from "../../evidence/types";
import { parseArgs } from "../args";
import type { Tool } from "../types";
import {
  banner,
  delivered,
  displayZone,
  findImage,
  flag,
  groupDigits,
  openImage,
  recordRef,
  requireEvidence,
  showTime,
  workstationFs,
  ZONE_OPTION,
  type DisplayZone,
} from "./shared";

const NAME = "lsfs";

export const lsfs: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner: "list the files inside a disk image, including the ones that were deleted.",
    usage: ["lsfs <image> [path] [-r] [-d] [-l] [--zone local]"],
    description: [
      "A disk image holds a file system, and a file system holds a table of records: one per file and folder, with its name, its size, who owns it, where its content sits on the disk, and four times.",
      "lsfs lists those records. With no path it starts at the top of the drive; give it a folder and it lists what is directly inside. -r walks everything below it.",
      "Deleting a file does not remove its record. It marks the record free and leaves the name, the size and the times behind, so a listing like this one still shows it, with a * in front. -d shows only those.",
      "Times are printed in UTC, ending in Z, so two pieces of evidence can be compared without guessing. --zone local shows them the way the computer they came from displayed them.",
    ],
    options: [
      {
        flags: "-r, --recursive",
        text: "List everything below the folder, not only what is in it.",
      },
      { flags: "-d, --deleted", text: "Show only deleted records." },
      {
        flags: "-l, --long",
        text: "Show the record number, size, owner and all four MACB times.",
      },
      {
        flags: "--zone <utc|local>",
        text: "Show times in UTC (the default) or as the drive's own computer showed them.",
      },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      { command: "lsfs qf-lt-07", text: "List the top of the drive in your working copy." },
      {
        command: "lsfs qf-lt-07 'C:\\Users\\dana\\Documents' -l",
        text: "List one folder with sizes, owners and times.",
      },
      { command: "lsfs qf-lt-07 -r -d", text: "Every deleted record on the drive." },
    ],
    concept: [
      "Most of an investigation starts here: what was on this machine, and what used to be. The deleted records are often the interesting half, because someone tidying up leaves a shape behind even when the content is gone.",
      "The four times each record carries are written M, A, C and B: modified (the content changed), accessed (something opened it), changed (the record itself changed, such as a rename or a permission edit), and born (it was created). Together they are called MACB, and reading them in order is how a timeline gets built.",
      "Times lie more often than people expect. A file copied onto a drive can arrive with a born time later than its modified time, and some systems stop updating access times to save writes. A time is evidence, not a verdict.",
    ],
    realWorld: [
      "The Sleuth Kit's fls, which lists file names from a file system image and marks deleted entries.",
      "Autopsy's file view and its Deleted Files node.",
      "On a live Windows machine the same table is the NTFS master file table, read by tools such as MFTECmd.",
    ],
    lesson: "disk-partitions-and-filesystems",
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-r", "--recursive"], key: "recursive" },
      { names: ["-d", "--deleted"], key: "deleted" },
      { names: ["-l", "--long"], key: "long" },
      ZONE_OPTION,
    ]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [name, where, extra] = parsed.value.positionals;
    if (name === undefined) {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "image" }, state);
    }
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "path", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const session = requireEvidence(state);
    if (!session.ok) return failure(NAME, session.error, state);
    const zone = displayZone(session.value, parsed.value);
    if (!zone.ok) return failure(NAME, zone.error, state);

    const fs = workstationFs(state, ctx);
    const target = findImage(session.value, fs.vfs, fs.ctx, name);
    if (!target.ok) return failure(NAME, target.error, state);

    const opened = openImage(state, target.value, NAME, ctx.now);
    const view = opened.view;
    const root = topOf(view);
    const path = where ?? root;
    const isTop = where !== undefined && trimSlash(where) === trimSlash(root);
    if (where !== undefined && !isTop && view.atPath(where).length === 0) {
      return failure(NAME, { code: "ENOENT", path: where }, opened.state, opened.events);
    }

    const recursive = flag(parsed.value, "recursive");
    const listed = recursive ? below(view, path) : view.children(path);
    const deletedOnly = flag(parsed.value, "deleted");
    const shown = deletedOnly ? listed.filter((record) => record.deleted) : listed;
    const deleted = shown.filter((record) => record.deleted).length;

    const tally = [
      plural(shown.length, "record"),
      ...(deletedOnly ? ["deleted only"] : deleted > 0 ? [`${deleted} deleted`] : []),
    ].join(", ");
    const long = flag(parsed.value, "long");
    const output: OutputLine[] = [
      banner(NAME, view.image.id, path, tally, ...(long ? [`times in ${zone.value.label}`] : [])),
      stdout(""),
      ...rows(shown, view.image.id, zone.value, long, recursive, path),
      stdout(""),
      stdout("* marks a deleted record: the name and times are still here, and the content may be"),
      stdout(`too. Ask about one with: inode ${view.image.id} <record>`),
    ];
    if (opened.warning) output.push(stdout(""), ...opened.warning.map(stdout));
    return delivered(opened.state, [NAME, ...args].join(" "), output, opened.events);
  },
};

/** The top of the drive: the first record's drive letter, so "C:\\" without assuming it. */
function topOf(view: DiskView): string {
  for (const record of view.records) {
    const drive = /^([A-Za-z]:)\\/.exec(record.path)?.[1];
    if (drive) return `${drive}\\`;
  }
  return "C:\\";
}

/** A Windows path without its trailing separator, so "C:\\" and "C:" compare the same. */
const trimSlash = (path: string): string =>
  path.endsWith("\\") ? path.slice(0, -1).toLowerCase() : path.toLowerCase();

/** Every record below a folder, in record order, the folder itself left out. */
function below(view: DiskView, path: string): readonly FileRecord[] {
  const key = trimSlash(path);
  return view.records.filter((record) => {
    const own = trimSlash(record.path);
    return own.startsWith(`${key}\\`) && own !== key;
  });
}

function rows(
  records: readonly FileRecord[],
  image: string,
  zone: DisplayZone,
  long: boolean,
  recursive: boolean,
  base: string,
): OutputLine[] {
  if (records.length === 0) {
    return [stdout("  (no records here)")];
  }
  const label = (record: FileRecord) => {
    const name = recursive ? relative(record.path, base) : baseName(record.path);
    return record.kind === "dir" ? `${name}\\` : name;
  };
  const header = long
    ? ["", "RECORD", "SIZE", "OWNER", "M", "A", "C", "B", "NAME"]
    : ["", "RECORD", "SIZE", "NAME"];
  const body = records.map((record) => {
    const mark = record.deleted ? "*" : " ";
    const size = record.kind === "dir" ? "-" : groupDigits(record.size);
    const common = [mark, String(record.record), size];
    return long
      ? [
          ...common,
          record.owner,
          showTime(record.times.m, zone),
          showTime(record.times.a, zone),
          showTime(record.times.c, zone),
          showTime(record.times.b, zone),
          label(record),
        ]
      : [...common, label(record)];
  });
  const table = columns([header, ...body]);
  const headerLine = table[0] as string;
  return [
    stdout(`  ${headerLine}`),
    ...table.slice(1).map((line, index) => {
      const record = records[index] as FileRecord;
      return { stream: "stdout" as const, text: `  ${line}`, ref: recordRef(image, record.record) };
    }),
  ];
}

/** "C:\\Users\\dana\\a.txt" below "C:\\Users" reads as "dana\\a.txt". */
function relative(path: string, base: string): string {
  const prefix = base.replace(/\\$/, "");
  return path.toLowerCase().startsWith(`${prefix.toLowerCase()}\\`)
    ? path.slice(prefix.length + 1)
    : path;
}
