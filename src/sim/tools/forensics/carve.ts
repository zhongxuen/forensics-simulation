/**
 * carve: finds files in a disk image's unallocated space by the shape of their first and last
 * bytes, with no file record to go on (docs/plan/07-carve-strings-logq.md).
 *
 * Once a file's record is gone, nothing says where its content was or what it was called. What is
 * left is the bytes, and most formats announce themselves: a PDF starts `%PDF-`, a ZIP `PK 03 04`.
 * The signature table and its citations live in `evidence/magic.ts`; this is the tool around it.
 */
import { columns, failure, plural, stdout } from "../../core/output";
import { withSessionFs } from "../../core/session";
import type { OutputLine, SimEvent } from "../../core/types";
import { decodeBase64 } from "../../evidence/base64";
import { utf8Bytes } from "../../evidence/bytes";
import {
  CARVE_TYPES,
  carveBytes,
  isCarveType,
  signatureFor,
  type CarvedObject,
  type CarveType,
} from "../../evidence/magic";
import { formatRef } from "../../evidence/refs";
import type { ArtefactRef } from "../../evidence/types";
import { mkdir, writeFile } from "../../fs/ops";
import { optionValue, parseArgs } from "../args";
import type { Tool } from "../types";
import {
  banner,
  delivered,
  findImage,
  groupDigits,
  openImage,
  outPath,
  requireEvidence,
  workstationFs,
} from "./shared";

const NAME = "carve";

/** What the player may type after `--type`, beside the table's own names. */
const TYPE_ALIASES: Readonly<Record<string, CarveType>> = { jpeg: "jpg" };

/** The ref `pin` stores for an object carved at `offset` in an image's unallocated space. */
export const carveRef = (image: string, offset: number): ArtefactRef =>
  formatRef({ kind: "carve", image, offset });

/**
 * Bytes as workstation text, one character per byte. The workstation's files hold text, and this
 * is the one way to put arbitrary bytes into text and get every one of them back
 * (`bytesFromWorkstationText`), so a carved ZIP written out is still that ZIP.
 */
export function workstationText(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return text;
}

/**
 * A workstation file's text as bytes: one byte per character when every character fits in one
 * (which is how `workstationText` wrote it), UTF-8 otherwise, as an ordinary text file would be.
 */
export function bytesFromWorkstationText(text: string): Uint8Array {
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) > 0xff) return utf8Bytes(text);
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

export const carve: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner:
      "find files in a disk image's free space by their first bytes, with no name to go on.",
    usage: ["carve <image> [--type pdf,zip,jpg,png] [--out <folder>]"],
    description: [
      "When a file is deleted and its record is later reused or lost, nothing on the drive says where the file was any more. Its content can still be sitting in the unallocated space: the parts of the drive no record points at.",
      "carve searches that space for file signatures, the fixed bytes a format always starts with (a PDF starts %PDF-, a ZIP starts PK) and, where it has one, the marker it ends with. Everything between a start and its end is cut out as one object.",
      "Each object is listed with its offset (how many bytes into the unallocated space it starts), its type, its size and its ref, which is what pin stores.",
      "An object marked partial has a start but no end: something was written over the rest of it. The part that survives can still be read with strings.",
    ],
    options: [
      {
        flags: "-t, --type <list>",
        text: "Only look for these types, separated by commas: pdf, zip, jpg, png.",
      },
      {
        flags: "-o, --out <folder>",
        text: "Write each object to this folder on the workstation, named by its offset.",
      },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      { command: "carve qf-lt-07", text: "Search your working copy's free space for every type." },
      {
        command: "carve qf-lt-07 --type pdf,zip --out ~/cases/carved",
        text: "Only PDFs and ZIPs, written into your case folder.",
      },
    ],
    concept: [
      "Carved files have no name and no timestamps. Those lived in the file record, and carving works without one, so a carved file can only be described by where it was found and what it contains. Say exactly that in a report: the image, the offset, and how you know what it is.",
      "Carving finds content that deleting and emptying the recycle bin left behind, which is why a responder wants a machine left alone: every new write can land on top of an old file and cut it short.",
      "A signature is a strong hint, not proof. Some formats hold others inside them (a ZIP can hold a PDF), and a partial object can run on into whatever was written after it. Read what you carved before you rely on it.",
    ],
    realWorld: [
      "PhotoRec and Foremost, which carve by header and footer signatures; Scalpel, which grew out of Foremost.",
      "Autopsy's carving ingest module (it runs PhotoRec over unallocated space) and bulk_extractor.",
      "Signatures come from the formats' own specifications: ISO 32000 for PDF, PKWARE's APPNOTE for ZIP, ITU-T T.81 for JPEG and the W3C PNG specification.",
    ],
    lesson: "disk-carving",
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-t", "--type"], key: "type", takesValue: true },
      { names: ["-o", "--out"], key: "out", takesValue: true },
    ]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [name, extra] = parsed.value.positionals;
    if (name === undefined) {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "image" }, state);
    }
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "image", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const types = parseTypes(optionValue(parsed.value, "type"));
    if (!types.ok) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "--type", value: types.value, reason: "unknown-value" },
        state,
      );
    }

    const session = requireEvidence(state);
    if (!session.ok) return failure(NAME, session.error, state);
    const fs = workstationFs(state, ctx);
    const target = findImage(session.value, fs.vfs, fs.ctx, name);
    if (!target.ok) return failure(NAME, target.error, state);
    const out = optionValue(parsed.value, "out");
    const folder = out === undefined ? undefined : outPath(state, out);
    if (folder && !folder.ok) return failure(NAME, folder.error, state);

    const opened = openImage(state, target.value, NAME, ctx.now);
    const image = opened.view.image;
    const space = decodeBase64(image.unallocatedB64);
    const found = carveBytes(space, types.value);

    const output: OutputLine[] = [
      banner(
        NAME,
        image.id,
        `unallocated space, ${groupDigits(space.length)} bytes`,
        types.value.join(", "),
      ),
      stdout(""),
    ];
    if (found.length === 0) {
      output.push(...nothingFound(image.id, types.value, space.length));
      if (opened.warning) output.push(stdout(""), ...opened.warning.map(stdout));
      return delivered(opened.state, [NAME, ...args].join(" "), output, opened.events);
    }

    output.push(...table(image.id, found));

    // Writing out is all or nothing: a folder that can't be made stops before any file lands.
    let nextState = opened.state;
    const written: SimEvent[] = [];
    if (folder?.ok) {
      const made = mkdir(fs.vfs, fs.ctx, folder.value, { parents: true });
      if (!made.ok) return failure(NAME, made.error, opened.state, opened.events);
      let vfs = made.value;
      output.push(stdout(""));
      for (const object of found) {
        const path = `${folder.value.replace(/\/+$/, "")}/${fileName(object)}`;
        const saved = writeFile(vfs, fs.ctx, path, workstationText(object.bytes));
        if (!saved.ok) return failure(NAME, saved.error, opened.state, opened.events);
        vfs = saved.value;
        output.push({
          stream: "stdout",
          text: `  Written  ${path}`,
          ref: carveRef(image.id, object.offset),
        });
        written.push({
          type: "file.changed",
          hostId: state.session.hostId,
          path,
          change: "created",
        });
      }
      nextState = withSessionFs(opened.state, vfs);
    }

    output.push(stdout(""), ...summary(image.id, found));
    if (opened.warning) output.push(stdout(""), ...opened.warning.map(stdout));

    const carved: SimEvent[] = found.map((object) => ({
      type: "evidence.carved",
      image: image.id,
      ref: carveRef(image.id, object.offset),
      fileType: object.type,
      bytes: object.size,
      complete: object.complete,
    }));
    return delivered(nextState, [NAME, ...args].join(" "), output, [
      ...opened.events,
      ...written,
      ...carved,
    ]);
  },
};

/** "pdf,zip" → the types, in the table's order. Absent means every type. */
function parseTypes(
  value: string | undefined,
): { ok: true; value: CarveType[] } | { ok: false; value: string } {
  if (value === undefined) return { ok: true, value: [...CARVE_TYPES] };
  const wanted = new Set<CarveType>();
  for (const word of value.split(",")) {
    const typed = word.trim().toLowerCase();
    const type = Object.hasOwn(TYPE_ALIASES, typed) ? TYPE_ALIASES[typed] : typed;
    if (type === undefined || !isCarveType(type)) return { ok: false, value: word };
    wanted.add(type);
  }
  return { ok: true, value: CARVE_TYPES.filter((type) => wanted.has(type)) };
}

/** "carve-1024.pdf": carved objects have no name, so they are named by where they were found. */
const fileName = (object: CarvedObject): string =>
  `carve-${object.offset}.${signatureFor(object.type).extension}`;

function table(image: string, found: readonly CarvedObject[]): OutputLine[] {
  const rows = [
    ["Offset", "Type", "Size", "Ends with", "Ref"],
    ...found.map((object) => [
      String(object.offset),
      object.type,
      `${groupDigits(object.size)} bytes`,
      object.complete ? signatureFor(object.type).footerText : "nothing: partial",
      carveRef(image, object.offset),
    ]),
  ];
  return columns(rows).map((text, index) => {
    const object = found[index - 1];
    return object
      ? { stream: "stdout", text: `  ${text}`, ref: carveRef(image, object.offset) }
      : stdout(`  ${text}`);
  });
}

function summary(image: string, found: readonly CarvedObject[]): OutputLine[] {
  const partial = found.filter((object) => !object.complete);
  const lines = [
    `${plural(found.length, "object")}: ${found.length - partial.length} complete, ${partial.length} partial.`,
    "",
    "Carved objects have no name and no timestamps. Those lived in the file record,",
    "and carving works without one, so name each object by its ref when you write it up.",
  ];
  const first = partial[0];
  if (first) {
    lines.push(
      "",
      `The ${first.type} at offset ${first.offset} has a start but no end: something was written over`,
      `the rest of it. What survives can still be read: strings ${carveRef(image, first.offset)}`,
    );
  }
  return lines.map(stdout);
}

/** The empty state: what would be here, why it isn't, and one thing to try. */
function nothingFound(image: string, types: readonly CarveType[], bytes: number): OutputLine[] {
  const what =
    types.length === CARVE_TYPES.length ? "file signatures" : `${types.join(", ")} signatures`;
  return [
    stdout(
      bytes === 0
        ? `No ${what} found: this image has no unallocated space left to search.`
        : `No ${what} found in ${groupDigits(bytes)} bytes of unallocated space.`,
    ),
    stdout("Deleted content can be in a format this tool doesn't know, or written over for good."),
    stdout(`Look for readable text instead with: strings ${image}`),
  ];
}
