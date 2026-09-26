/**
 * recover: writes a deleted file's content out of a disk image onto the workstation.
 *
 * Deleting a file frees its clusters; it does not wipe them. While nothing has been written over
 * them the content is still there, and this writes it out. Once something has, the bytes are gone
 * and the tool says so in one sentence instead of writing half a file
 * (docs/plan/04-disk-tools.md).
 */
import { errorLineText, failure, stdout } from "../../core/output";
import { withSessionFs } from "../../core/session";
import type { OutputLine, SimEvent, SimResult } from "../../core/types";
import { formatError } from "../../core/errors";
import { hashHex } from "../../evidence/hash";
import type { FileRecord } from "../../evidence/types";
import { writeFile } from "../../fs/ops";
import { optionValue, parseArgs } from "../args";
import type { Tool } from "../types";
import {
  banner,
  clusterRanges,
  clusterReuse,
  delivered,
  findImage,
  groupDigits,
  openImage,
  outPath,
  parseRecordNumber,
  recordRef,
  requireEvidence,
  requireRecord,
  workstationFs,
} from "./shared";

const NAME = "recover";

export const recover: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner: "write a deleted file's content out of a disk image, while it is still there.",
    usage: ["recover <image> <record> --out <path>"],
    description: [
      "Deleting a file does not erase it. The file system marks its record free and its clusters available, and the content stays exactly where it was until something else is written over it.",
      "recover reads those clusters out of the image and writes what it finds to a file in your own folders. The image is not touched: what you get is a copy of bytes that are still on the drive.",
      "It checks first. If another file has taken any of those clusters, it stops and says so, because half a recovered file looks like a whole one and would mislead a report.",
      "Find the record number with lsfs -d, and check it with inode before you write anything out.",
    ],
    options: [
      { flags: "-o, --out <path>", text: "Where to write the recovered content. Required." },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      {
        command: "recover qf-lt-07 51 --out /home/examiner/cases/recovered/inv-0413.pdf",
        text: "Write record 51's content into your case folder.",
      },
    ],
    concept: [
      "This is why an incident responder wants the machine switched off early. Every write to a drive is another chance that the one file you needed is the one that gets written over, and a busy machine writes constantly, without anybody asking it to.",
      "Recovering by record number, the way this does, only works while the record survives. When the record itself is gone, or the file system is damaged, the next step is carving: searching the free space for the shapes of file formats, with no names or times attached.",
      "Whatever you recover, say where it came from. A recovered file with no record number, no cluster list and no note about what might have overwritten it is a claim, not evidence.",
    ],
    realWorld: [
      "Autopsy's Extract File, and The Sleuth Kit's icat, which copies a file's content out by its metadata number.",
      "Recycle bin and $I file parsers, for files that were deleted the ordinary way.",
      "When the record is gone: carving tools such as PhotoRec, Foremost and Scalpel (this game's carve, in file 07).",
    ],
    lesson: "disk-deleted-vs-overwritten",
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [{ names: ["-o", "--out"], key: "out", takesValue: true }]);
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
    const out = optionValue(parsed.value, "out");
    if (out === undefined) {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "--out" }, state);
    }
    const wanted = parseRecordNumber(number);
    if (!wanted.ok) return failure(NAME, wanted.error, state);

    const session = requireEvidence(state);
    if (!session.ok) return failure(NAME, session.error, state);
    const fs = workstationFs(state, ctx);
    const target = findImage(session.value, fs.vfs, fs.ctx, name);
    if (!target.ok) return failure(NAME, target.error, state);
    const destination = outPath(state, out);
    if (!destination.ok) return failure(NAME, destination.error, state);

    const opened = openImage(state, target.value, NAME, ctx.now);
    const view = opened.view;
    const image = view.image;
    const record = requireRecord(view, image.id, wanted.value);
    if (!record.ok) return failure(NAME, record.error, opened.state, opened.events);
    const file = record.value;
    if (file.kind === "dir") {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "record", value: number, reason: "unknown-value" },
        opened.state,
        opened.events,
      );
    }

    const reuse = clusterReuse(view, file);
    if (file.deleted && reuse.clusters.length > 0) {
      return overwritten(opened.state, image.id, file, reuse, opened.events);
    }

    const content = new TextDecoder().decode(view.content(file));
    const written = writeFile(fs.vfs, fs.ctx, destination.value, content);
    if (!written.ok) return failure(NAME, written.error, opened.state, opened.events);

    const sha256 = hashHex("sha256", view.content(file));
    const ref = recordRef(image.id, file.record);
    const output: OutputLine[] = [
      banner(NAME, image.id, `record ${file.record} → ${destination.value}`),
      stdout(""),
      {
        stream: "stdout",
        text: `  From      ${file.path}${file.deleted ? " (deleted)" : ""}`,
        ref,
      },
      stdout(`  Clusters  ${clusterRanges(file.clusters)}, none reused`),
      stdout(`  Written   ${groupDigits(file.size)} bytes`),
      stdout(`  SHA-256   ${sha256}`),
      stdout(""),
      stdout("The image is untouched. What you wrote is a copy of the bytes still sitting in"),
      stdout("those clusters. Say so in the report, with the record number and the cluster list."),
    ];
    if (opened.warning) output.push(stdout(""), ...opened.warning.map(stdout));

    const events: SimEvent[] = [
      ...opened.events,
      {
        type: "file.changed",
        hostId: state.session.hostId,
        path: destination.value,
        change: "created",
      },
      {
        type: "evidence.recovered",
        image: image.id,
        record: file.record,
        path: destination.value,
        ref,
        bytes: file.size,
      },
    ];
    return delivered(
      withSessionFs(opened.state, written.value),
      [NAME, ...args].join(" "),
      output,
      events,
    );
  },
};

/** The one thing recover refuses to do, with the one sentence that explains why. */
function overwritten(
  state: SimResult["state"],
  image: string,
  file: FileRecord,
  reuse: ReturnType<typeof clusterReuse>,
  events: readonly SimEvent[],
): SimResult {
  const error = { code: "CLUSTERS_REUSED", image, record: file.record } as const;
  const taken = clusterRanges(reuse.clusters);
  const output: OutputLine[] = [
    errorLineText(formatError(NAME, error), error),
    stdout(
      `Deleting ${file.path} freed cluster${reuse.clusters.length === 1 ? "" : "s"} ${taken}, and ` +
        `${reuse.by ? `${reuse.by.path} has since been written there` : "something has since been written there"}, ` +
        "so the old content is gone.",
    ),
    stdout(""),
    stdout(`The record itself is still evidence: inode ${image} ${file.record} shows the name,`),
    stdout("the size and the times, which is often enough to show the file existed."),
  ];
  return { state, output, events, exitCode: 1 };
}
