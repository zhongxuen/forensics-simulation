/**
 * acquire: makes a working copy of an evidence device and prints the copy's hashes.
 *
 * Imaging is the first thing that happens to a drive in an investigation, and everything after it
 * is done to the copy. The copy here is a whole `DiskImage`, taken from the device as it stands at
 * the moment of the read, so a device read with the write-blocker off is copied with the access
 * times that read gave it, hash and all (docs/plan/04-disk-tools.md).
 */
import { failure, stdout } from "../../core/output";
import { withSessionFs } from "../../core/session";
import type { OutputLine, SimEvent } from "../../core/types";
import { hashHex } from "../../evidence/hash";
import { imageBytes } from "../../evidence/image";
import { withAcquiredImage } from "../../evidence/session";
import type { DiskImage } from "../../evidence/types";
import { writeFile } from "../../fs/ops";
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

const NAME = "acquire";

/** How many progress lines the copy prints. Fixed, so a transcript is the same every run. */
const PROGRESS_STEPS = 4;

export const acquire: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner: "make a working copy of a drive you were handed, and hash both ends of the copy.",
    usage: ["acquire <device> --out <path>"],
    description: [
      "An examiner never works on the drive itself. The first step is imaging: reading the drive from end to end and writing every byte into a file, called a disk image. From then on, every question is asked of the image.",
      "acquire does that here. Point it at a device under /dev/evidence and give it somewhere in your own folders to write, and it copies the drive, sector by sector, into an image file.",
      "When it finishes it prints two hashes of the image. A hash is a short fingerprint of a pile of bytes: change one byte anywhere and the fingerprint changes completely. Compare it with the hash on the handover form and you can show the copy is faithful.",
      "It refuses to write onto the evidence device, and it tells you if the write-blocker was off, because then the drive you copied is no longer the drive you were handed.",
    ],
    options: [
      { flags: "-o, --out <path>", text: "Where to write the image file. Required." },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      {
        command: "acquire /dev/evidence/qf-lt-07 --out /home/examiner/cases/qf-lt-07.img",
        text: "Copy the drive from qf-lt-07 into your case folder.",
      },
      {
        command: "acquire qf-lt-07 --out /home/examiner/cases/qf-lt-07.img",
        text: "The device's name on its own works too.",
      },
    ],
    concept: [
      "Imaging plus hashing is what makes digital evidence hold up. The image is what you examine, the hash is the proof the image matches the drive, and the drive goes back in the bag untouched. If anyone later asks whether you changed the evidence, the two hashes answer for you.",
      "It also protects the investigation from itself. Examining a copy means a mistake costs you a re-image, not the evidence. Guidance on this goes back a long way: RFC 3227 and NIST SP 800-86 both put imaging and hashing before any analysis.",
    ],
    realWorld: [
      "FTK Imager: File, then Create Disk Image, with MD5 and SHA-1 verification on the way out.",
      "Command-line imagers: dd, dcfldd and dc3dd on Linux, and ewfacquire for the EnCase (E01) format.",
      "This tool writes one whole image in one pass. Real imagers also offer split images, compression, and re-verification of a finished image.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [{ names: ["-o", "--out"], key: "out", takesValue: true }]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [device, extra] = parsed.value.positionals;
    if (device === undefined) {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "device" }, state);
    }
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "device", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const out = optionValue(parsed.value, "out");
    if (out === undefined) {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "--out" }, state);
    }

    const session = requireEvidence(state);
    if (!session.ok) return failure(NAME, session.error, state);

    const fs = workstationFs(state, ctx);
    const target = findImage(session.value, fs.vfs, fs.ctx, device);
    if (!target.ok) return failure(NAME, target.error, state);

    const destination = outPath(state, out);
    if (!destination.ok) return failure(NAME, destination.error, state);

    const opened = openImage(state, target.value, NAME, ctx.now);
    const copy = opened.view.image;
    const bytes = imageBytes(copy);
    const md5 = hashHex("md5", bytes);
    const sha256 = hashHex("sha256", bytes);

    const written = writeFile(fs.vfs, fs.ctx, destination.value, imagePlacard(copy, md5, sha256));
    if (!written.ok) return failure(NAME, written.error, state, opened.events);

    const next = withAcquiredImage(
      withSessionFs(opened.state, written.value),
      destination.value,
      copy,
    );
    const events: SimEvent[] = [
      ...opened.events,
      {
        type: "file.changed",
        hostId: state.session.hostId,
        path: destination.value,
        change: "created",
      },
      {
        type: "evidence.acquired",
        device: target.value.path,
        image: destination.value,
        sectors: copy.sectors,
        md5,
        sha256,
      },
    ];
    const output = report(target.value.path, destination.value, copy, md5, sha256, {
      blocker: target.value.device?.blocker ?? true,
      isDevice: target.value.device !== undefined,
      ...(opened.warning === undefined ? {} : { warning: opened.warning }),
    });
    return delivered(next, `${NAME} ${device} --out ${out}`, output, events);
  },
};

interface ReportOptions {
  readonly blocker: boolean;
  readonly isDevice: boolean;
  readonly warning?: readonly string[];
}

function report(
  from: string,
  to: string,
  copy: DiskImage,
  md5: string,
  sha256: string,
  options: ReportOptions,
): OutputLine[] {
  const total = copy.sectors;
  const output: OutputLine[] = [
    banner(NAME, `${from} → ${to}`),
    stdout(""),
    stdout(`  Source         ${copy.id} · ${copy.device.model} · serial ${copy.device.serial}`),
    stdout(`  Geometry       ${groupDigits(total)} sectors of ${copy.sectorSize} bytes`),
    stdout(
      `  Write-blocker  ${options.isDevice ? (options.blocker ? "on" : "off") : "not a device: this is already a copy"}`,
    ),
    stdout(""),
  ];
  for (let step = 1; step <= PROGRESS_STEPS; step++) {
    const done = Math.round((total * step) / PROGRESS_STEPS);
    const bar = "#".repeat(step * (20 / PROGRESS_STEPS)).padEnd(20, ".");
    output.push(stdout(`  [${bar}] ${groupDigits(done)} of ${groupDigits(total)} sectors`));
  }
  output.push(
    stdout(""),
    stdout(`  Copied ${groupDigits(total)} sectors in one pass. 0 unreadable sectors.`),
    stdout(""),
    stdout(`  MD5      ${md5}`),
    stdout(`  SHA-256  ${sha256}`),
    stdout(""),
    stdout("Both hashes are of the image's bytes. Check them against the handover form with:"),
    stdout(`  hashsum --verify <hash from the form> ${to}`),
  );
  if (options.warning) output.push(stdout(""), ...options.warning.map(stdout));
  return output;
}

/** What `cat` shows for an image file: what it is, not a screen of bytes. */
function imagePlacard(copy: DiskImage, md5: string, sha256: string): string {
  return [
    `Disk image of ${copy.id}`,
    "",
    `Device     ${copy.device.model}, serial ${copy.device.serial}`,
    `Geometry   ${copy.sectors} sectors of ${copy.sectorSize} bytes`,
    `Records    ${copy.records.length}`,
    `MD5        ${md5}`,
    `SHA-256    ${sha256}`,
    "",
    "This is a working copy. Open it with the disk tools, not with cat:",
    "",
    `  lsfs ${copy.id} -r`,
    `  hashsum ${copy.id}`,
    "",
  ].join("\n");
}
