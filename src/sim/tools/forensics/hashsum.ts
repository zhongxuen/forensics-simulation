/**
 * hashsum: takes a fingerprint of a disk image, an evidence device, or one file on the
 * workstation, and can check it against a hash someone else wrote down.
 *
 * A hash of an image is always the hash of `imageBytes` (src/sim/evidence/image.ts), the one byte
 * layout the whole game agrees on, so the generator, the handover form and this tool can never
 * disagree about what a drive's hash is.
 */
import { failure, stdout } from "../../core/output";
import type { OutputLine, SimEvent } from "../../core/types";
import { hashHex, HASH_ALGORITHMS, isHashAlgorithm, type HashAlgorithm } from "../../evidence/hash";
import { imageBytes } from "../../evidence/image";
import { utf8Bytes } from "../../evidence/bytes";
import { readFile } from "../../fs/ops";
import { optionValue, parseArgs } from "../args";
import type { Tool } from "../types";
import {
  banner,
  delivered,
  findImage,
  groupDigits,
  openImage,
  requireEvidence,
  workstationFs,
} from "./shared";

const NAME = "hashsum";

/** How long each algorithm's hex digest is, so a typo in `--verify` is caught before comparing. */
const DIGEST_LENGTH: Readonly<Record<HashAlgorithm, number>> = { md5: 32, sha1: 40, sha256: 64 };

export const hashsum: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner: "take a fingerprint of an image or a file, and check it against one you were given.",
    usage: [
      "hashsum [-a md5|sha1|sha256] <image|device|file>",
      "hashsum --verify <expected> <image|device|file>",
    ],
    description: [
      "A hash is a short fingerprint of a pile of bytes. Feed the same bytes in and you always get the same fingerprint out; change a single byte anywhere and the fingerprint changes completely. That is what lets you show a copy matches an original.",
      "Point hashsum at a disk image or an evidence device and it hashes the image's bytes. Point it at an ordinary file on this workstation and it hashes that file's content.",
      "--verify takes the hash someone else wrote down, usually on the handover form, and says MATCH or MISMATCH, with what each one means.",
      "SHA-256 is the default. MD5 and SHA-1 are here because forms and older tools still carry them, and the tool says so when it prints one.",
    ],
    options: [
      { flags: "-a, --algorithm <name>", text: "md5, sha1 or sha256. Defaults to sha256." },
      {
        flags: "-v, --verify <hash>",
        text: "Compare against this hash and say whether the two are the same.",
      },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      {
        command: "hashsum /home/examiner/cases/qf-lt-07.img",
        text: "The SHA-256 of the working copy.",
      },
      {
        command: "hashsum -a md5 /dev/evidence/qf-lt-07",
        text: "The MD5 of the original drive, to compare with an older form.",
      },
      {
        command: "hashsum --verify 5f2b... /home/examiner/cases/qf-lt-07.img",
        text: "Check the copy against the hash on the handover form.",
      },
    ],
    concept: [
      "Hashing is how the chain of custody is kept honest. The drive is hashed when it is handed over, the image is hashed when it is made, and the image is hashed again before the report goes out. Matching hashes are a short, checkable claim that nothing changed in between.",
      "It works in the other direction too. A MISMATCH is not a dead end: it tells you something changed, and finding out what, and when, is part of the investigation. Mounting a drive without a write-blocker is the usual answer.",
      "MD5 and SHA-1 can be forced to collide, so two different piles of bytes can share a fingerprint. That makes them poor at proving someone did not tamper with evidence on purpose, which is why SHA-256 is the default here.",
    ],
    realWorld: [
      "FTK Imager: Verify Drive/Image, and the hash report it writes next to an image.",
      "md5sum, sha1sum and sha256sum on Linux; Get-FileHash in PowerShell; certutil -hashfile on Windows.",
      "The hash fields on a chain-of-custody form, and hashdeep for hashing a whole folder at once.",
    ],
    lesson: "foundations-hashing-for-evidence",
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-a", "--algorithm"], key: "algorithm", takesValue: true },
      { names: ["-v", "--verify"], key: "verify", takesValue: true },
    ]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [name, extra] = parsed.value.positionals;
    if (name === undefined) {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "image, device or file" }, state);
    }
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "target", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const asked = optionValue(parsed.value, "algorithm") ?? "sha256";
    if (!isHashAlgorithm(asked)) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "--algorithm", value: asked, reason: "unknown-value" },
        state,
      );
    }
    const expected = optionValue(parsed.value, "verify")?.toLowerCase();
    if (
      expected !== undefined &&
      !new RegExp(`^[0-9a-f]{${DIGEST_LENGTH[asked]}}$`).test(expected)
    ) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "--verify", value: expected, reason: "bad-format" },
        state,
      );
    }

    const session = requireEvidence(state);
    if (!session.ok) return failure(NAME, session.error, state);
    const fs = workstationFs(state, ctx);
    const found = findImage(session.value, fs.vfs, fs.ctx, name);

    // An image or a device: hash the image's bytes. Anything else: hash the file's content.
    if (found.ok) {
      const opened = openImage(state, found.value, NAME, ctx.now);
      const image = opened.view.image;
      const digest = hashHex(asked, imageBytes(image));
      const what = `image bytes of ${image.id} · ${groupDigits(image.sectors)} sectors · ${groupDigits(image.records.length)} records`;
      const output = [
        ...lines(found.value.path, asked, digest, what),
        ...verdict(asked, digest, expected),
      ];
      if (opened.warning) output.push(stdout(""), ...opened.warning.map(stdout));
      const events: SimEvent[] = [
        ...opened.events,
        hashed(found.value.path, asked, digest, expected),
      ];
      return delivered(opened.state, command(args), output, events);
    }
    if (found.error.code !== "NOT_EVIDENCE") return failure(NAME, found.error, state);

    const content = readFile(fs.vfs, fs.ctx, name);
    if (!content.ok) return failure(NAME, content.error, state);
    const bytes = utf8Bytes(content.value);
    const digest = hashHex(asked, bytes);
    const output = [
      ...lines(name, asked, digest, `file content · ${groupDigits(bytes.length)} bytes`),
      ...verdict(asked, digest, expected),
    ];
    return delivered(state, command(args), output, [hashed(name, asked, digest, expected)]);
  },
};

const command = (args: readonly string[]) => [NAME, ...args].join(" ");

function hashed(
  target: string,
  algorithm: HashAlgorithm,
  digest: string,
  expected: string | undefined,
): SimEvent {
  return {
    type: "evidence.hashed",
    target,
    algorithm,
    digest,
    ...(expected === undefined ? {} : { verified: expected === digest }),
  };
}

function lines(
  target: string,
  algorithm: HashAlgorithm,
  digest: string,
  what: string,
): OutputLine[] {
  const output = [
    banner(NAME, algorithm, target),
    stdout(""),
    stdout(`  ${digest}`),
    stdout(`  ${what}`),
  ];
  if (algorithm !== "sha256") {
    output.push(
      stdout(""),
      stdout(
        `  ${algorithm.toUpperCase()} can be made to collide, so two different piles of bytes can share`,
      ),
      stdout("  this fingerprint. Forms and older tools still use it. For anything you have to"),
      stdout("  defend, take a sha256 as well."),
    );
  }
  return output;
}

/** What MATCH and MISMATCH mean, spelled out, because that is the whole point of --verify. */
function verdict(
  algorithm: HashAlgorithm,
  digest: string,
  expected: string | undefined,
): OutputLine[] {
  if (expected === undefined) return [];
  if (expected === digest) {
    return [
      stdout(""),
      stdout("  MATCH"),
      stdout(`  The ${algorithm} you were given is the ${algorithm} of what you just hashed, so`),
      stdout("  the two are byte for byte the same. Nothing has changed since that hash was"),
      stdout("  written down."),
    ];
  }
  return [
    stdout(""),
    stdout("  MISMATCH"),
    stdout(`  expected  ${expected}`),
    stdout(`  found     ${digest}`),
    stdout(""),
    stdout("  What you hashed is not what that hash was taken of. Something changed in"),
    stdout("  between, or the hash belongs to a different drive. Check which device you"),
    stdout("  pointed at, and whether its write-blocker was on: reading a drive without one"),
    stdout("  sets new access times, and that alone moves the hash."),
  ];
}

/** Exported for the help text and tests: the algorithms `-a` takes. */
export const HASHSUM_ALGORITHMS = HASH_ALGORITHMS;
