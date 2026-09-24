/**
 * inode: everything one file record says about itself.
 *
 * `lsfs` answers "what is on this drive?"; this answers "what exactly is record 51?" — its path,
 * its owner, its size, its four MACB times with a note about the zone they were displayed in, the
 * clusters its content sits in, and, for a deleted record, whether anything has been written over
 * those clusters since (docs/plan/04-disk-tools.md).
 */
import { failure, stdout } from "../../core/output";
import type { OutputLine } from "../../core/types";
import { formatOffset } from "../../evidence/time";
import { zoneOffsetMinutes, UTC_ZONE } from "../../evidence/time";
import type { FileRecord } from "../../evidence/types";
import { parseArgs } from "../args";
import type { Tool } from "../types";
import {
  banner,
  clusterRanges,
  clusterReuse,
  delivered,
  displayZone,
  findImage,
  groupDigits,
  openImage,
  parseRecordNumber,
  recordRef,
  requireEvidence,
  requireRecord,
  showTime,
  workstationFs,
  ZONE_OPTION,
  type DisplayZone,
} from "./shared";

const NAME = "inode";

/** What each MACB letter means, in the order an examiner reads them. */
interface TimeRow {
  readonly key: keyof FileRecord["times"];
  readonly letter: string;
  readonly name: string;
  readonly note: string;
}

const TIMES: readonly TimeRow[] = [
  { key: "m", letter: "M", name: "modified", note: "the content changed" },
  { key: "a", letter: "A", name: "accessed", note: "something opened it" },
  {
    key: "c",
    letter: "C",
    name: "changed",
    note: "the record changed: a rename, a permission edit",
  },
  { key: "b", letter: "B", name: "born", note: "it was created" },
];

export const inode: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner: "show everything one file record inside a disk image says about itself.",
    usage: ["inode <image> <record> [--zone local]"],
    description: [
      "Every file and folder on a drive has a record in the file system's table, and every record has a number. lsfs prints those numbers; inode opens one of them.",
      "It shows the path, the owner, the size, whether the record is deleted, the clusters the content sits in, and all four MACB times: modified, accessed, changed and born.",
      "For a deleted record it also says whether anything has been written over those clusters. While nothing has, the content is still sitting there and recover can write it out. Once something has, those bytes are gone.",
      "A cluster is the smallest piece of a drive a file system hands out, often a few kilobytes. A file takes whole clusters, so a small file still uses one, and the unused end of the last cluster is called slack.",
    ],
    options: [
      {
        flags: "--zone <utc|local>",
        text: "Show times in UTC (the default) or as the drive's own computer showed them.",
      },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      { command: "inode qf-lt-07 51", text: "Everything record 51 says about itself." },
      {
        command: "inode qf-lt-07 51 --zone local",
        text: "The same times, as the laptop's own clock showed them.",
      },
    ],
    concept: [
      "Metadata is often better evidence than content. A document's words tell you what it said; its record tells you when it was made, when it last changed, when something opened it, and who owned it. That is what a timeline is built from.",
      "For a deleted file, this screen is the difference between a name and a file. The record survives deletion, so you always get the name, the size and the times. Whether you also get the content depends entirely on whether the drive has reused those clusters, which is mostly a question of how much has happened since.",
      "Which is why the first thing an incident responder asks for is the machine, switched off, as soon as possible. Every minute it keeps running is another chance for something to write over the answer.",
    ],
    realWorld: [
      "The Sleuth Kit's istat, which prints one metadata entry from a file system image.",
      "Autopsy's metadata tab, and the MFT entry view in tools such as MFTECmd and MFTExplorer.",
      "stat on Linux and Get-Item on Windows show the same kind of record for a live file.",
    ],
    lesson: "disk-macb-timestamps",
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [ZONE_OPTION]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [name, number, extra] = parsed.value.positionals;
    if (name === undefined) {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "image" }, state);
    }
    if (number === undefined) {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "record" }, state);
    }
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "record", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const wanted = parseRecordNumber(number);
    if (!wanted.ok) return failure(NAME, wanted.error, state);

    const session = requireEvidence(state);
    if (!session.ok) return failure(NAME, session.error, state);
    const zone = displayZone(session.value, parsed.value);
    if (!zone.ok) return failure(NAME, zone.error, state);

    const fs = workstationFs(state, ctx);
    const target = findImage(session.value, fs.vfs, fs.ctx, name);
    if (!target.ok) return failure(NAME, target.error, state);

    const opened = openImage(state, target.value, NAME, ctx.now);
    const view = opened.view;
    const image = view.image;
    const record = requireRecord(view, image.id, wanted.value);
    if (!record.ok) return failure(NAME, record.error, opened.state, opened.events);

    const file = record.value;
    const ref = recordRef(image.id, file.record);
    const reuse = clusterReuse(view, file);
    const clusters = file.clusters.length;
    const output: OutputLine[] = [
      banner(NAME, image.id, `record ${file.record}`),
      stdout(""),
      { stream: "stdout", text: `  Path        ${file.path}`, ref },
      stdout(`  Owner       ${file.owner}`),
      stdout(`  Kind        ${file.kind === "dir" ? "folder" : "file"}`),
      stdout(`  Size        ${file.kind === "dir" ? "-" : `${groupDigits(file.size)} bytes`}`),
      stdout(`  Deleted     ${file.deleted ? "yes" : "no"}`),
      stdout(
        `  Clusters    ${clusterRanges(file.clusters)}` +
          (clusters === 0 ? "" : ` (${clusters} of ${groupDigits(image.clusterSize)} bytes)`),
      ),
      ...recoverability(file, reuse, image.id),
      stdout(""),
      stdout(`  Times (${zone.value.label})`),
      ...TIMES.map((row) =>
        stdout(
          `    ${row.letter} ${row.name.padEnd(9)}${showTime(file.times[row.key], zone.value).padEnd(26)}${row.note}`,
        ),
      ),
      ...zoneNote(session.value.set.zones.disk, zone.value, file.times.m),
      stdout(""),
      { stream: "stdout", text: `  Ref         ${ref}`, ref },
      stdout("  Pin it with: pin"),
    ];
    if (opened.warning) output.push(stdout(""), ...opened.warning.map(stdout));
    return delivered(opened.state, [NAME, ...args].join(" "), output, opened.events);
  },
};

/** For a deleted record: whether the content is still there, and what to do about it. */
function recoverability(
  file: FileRecord,
  reuse: ReturnType<typeof clusterReuse>,
  image: string,
): OutputLine[] {
  if (!file.deleted || file.kind === "dir") return [];
  if (reuse.clusters.length === 0) {
    return [
      stdout("  Reused      no: nothing has been written over those clusters yet"),
      stdout(""),
      stdout(`  The content is still on the drive. Write it out with:`),
      stdout(`    recover ${image} ${file.record} --out <path>`),
    ];
  }
  const taken = clusterRanges(reuse.clusters);
  return [
    stdout(
      `  Reused      yes: ${taken} ${reuse.clusters.length === 1 ? "holds" : "hold"} something else now`,
    ),
    ...(reuse.by
      ? [stdout(`              ${reuse.by.path} (record ${reuse.by.record}) has them`)]
      : []),
    stdout(""),
    stdout("  Deleting a file only frees its clusters; the content stays until something"),
    stdout("  writes over them. Something has, so those bytes are gone. The record itself,"),
    stdout("  with the name, the size and the times, is still evidence."),
  ];
}

/** When UTC is on screen but the drive's computer showed something else, say so once. */
function zoneNote(diskZone: string | undefined, zone: DisplayZone, at: number): OutputLine[] {
  if (diskZone === undefined || zone.zone !== UTC_ZONE) return [];
  const offset = formatOffset(zoneOffsetMinutes(diskZone, at));
  return [
    stdout(""),
    stdout(`  These are UTC. The machine this drive came from showed ${diskZone} (${offset})`),
    stdout("  at that moment, so a screenshot or a witness would name a different hour."),
    stdout("  Pass --zone local to read them that way."),
  ];
}
