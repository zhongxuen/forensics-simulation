/**
 * Every expected failure the engine can report, as a stable code plus context.
 *
 * The engine stays terse and realistic: it prints the line a real terminal would print, and attaches
 * the typed error to it. The terminal (phase 05) maps each code to a beginner-friendly explanation,
 * so the tone can change without touching simulation logic. Codes are a public contract: never
 * rename or reuse one.
 */

/** Filesystem failures, named after their POSIX equivalents. */
export const FS_ERROR_CODES = [
  "ENOENT", // no such file or directory
  "EACCES", // permission denied by the file's mode bits
  "EPERM", // operation not permitted (only the owner or root may do this)
  "ENOTDIR", // a path component is not a directory
  "EISDIR", // expected a file, found a directory
  "EEXIST", // something already exists at that path
  "ENOTEMPTY", // directory not empty
  "ELOOP", // too many symbolic links (usually a loop)
  "EINVAL", // the request makes no sense (see `detail`)
  "EBUSY", // refusing to touch the root directory
  "EFBIG", // a write would make a file bigger than the simulation allows
] as const;

export const SIM_ERROR_CODES = [
  ...FS_ERROR_CODES,
  "UNKNOWN_COMMAND", // no tool with that name
  "BAD_FLAG", // an option the tool doesn't have
  "MISSING_ARGUMENT", // a required argument or option value is missing
  "BAD_ARGUMENT", // an argument is present but unusable (see `reason`)
  "HOST_NOT_FOUND", // a name that no simulated computer answers to
  "HOST_UNREACHABLE", // nothing answered: the host is firewalled off, or no host is there
  "CONNECTION_REFUSED", // the host answered, but nothing is listening on that port
  "PROTOCOL_MISMATCH", // something is listening, but it speaks a different protocol
  "OUT_OF_SCOPE", // a target outside the simulated network; nothing is ever sent
  "SUDO_DENIED", // the user may not act as root with sudo
  "NO_MANUAL_ENTRY", // `man` has no page by that name
  // Forensics (docs/plan/04-disk-tools.md). Evidence is read-only data, not the workstation's
  // filesystem, so its failures are their own codes rather than borrowed POSIX ones.
  "EVIDENCE_NOT_LOADED", // no evidence set is attached to this workstation
  "NOT_EVIDENCE", // that name is neither an evidence device nor a disk image
  "WRITE_TO_EVIDENCE", // refusing to write onto the evidence device itself
  "RECORD_NOT_FOUND", // no file record with that number in the image
  "CLUSTERS_REUSED", // a deleted file's clusters hold something else now
  "NOTHING_TO_PIN", // that output line names no artefact (see `reason`)
] as const;

export type FsErrorCode = (typeof FS_ERROR_CODES)[number];
export type SimErrorCode = (typeof SIM_ERROR_CODES)[number];

/** Why an `EINVAL`, `EISDIR`, `EPERM` or `EBUSY` happened, when the code alone is ambiguous. */
export type FsErrorDetail =
  | "bad-name" // empty, too long, or contains "/"
  | "dot-path" // "." or ".." as the last part of a path
  | "into-itself" // moving or copying a directory inside itself
  | "root" // the root directory "/"
  | "omit-directory" // copying a directory without asking for recursion
  | "sticky" // a sticky-bit directory, like /tmp, protects other people's files
  | "unknown-user"
  | "unknown-group";

export interface FsError {
  readonly code: FsErrorCode;
  /** The path as the learner typed it, like a real tool would print it. */
  readonly path: string;
  readonly detail?: FsErrorDetail;
  /** The offending user or group name, for `unknown-user` and `unknown-group`. */
  readonly value?: string;
}

/** Why a `NOTHING_TO_PIN` happened: nothing printed yet, or a line with no artefact on it. */
export type NothingToPinReason = "no-output" | "no-ref";

export type BadArgumentReason =
  | "bad-format" // not shaped like what the tool expects
  | "out-of-range" // a number outside what's allowed (a port above 65535)
  | "range-too-large" // a network range too big to scan
  | "too-long" // longer than the tool accepts
  | "unknown-value" // not one of the allowed words
  | "extra-argument"; // more arguments than the tool takes

export type SimError =
  | FsError
  | { readonly code: "UNKNOWN_COMMAND"; readonly command: string }
  | { readonly code: "BAD_FLAG"; readonly flag: string }
  | { readonly code: "MISSING_ARGUMENT"; readonly argument: string }
  | {
      readonly code: "BAD_ARGUMENT";
      readonly argument: string;
      readonly value: string;
      readonly reason: BadArgumentReason;
    }
  | { readonly code: "HOST_NOT_FOUND"; readonly target: string }
  | { readonly code: "HOST_UNREACHABLE"; readonly target: string; readonly port?: number }
  | { readonly code: "CONNECTION_REFUSED"; readonly target: string; readonly port: number }
  | {
      readonly code: "PROTOCOL_MISMATCH";
      readonly target: string;
      readonly port: number;
      readonly expected: string;
      readonly found: string;
    }
  | { readonly code: "OUT_OF_SCOPE"; readonly target: string }
  | { readonly code: "SUDO_DENIED"; readonly user: string }
  | { readonly code: "NO_MANUAL_ENTRY"; readonly topic: string }
  | { readonly code: "EVIDENCE_NOT_LOADED" }
  | { readonly code: "NOT_EVIDENCE"; readonly name: string }
  | { readonly code: "WRITE_TO_EVIDENCE"; readonly path: string }
  | { readonly code: "RECORD_NOT_FOUND"; readonly image: string; readonly record: number }
  | { readonly code: "CLUSTERS_REUSED"; readonly image: string; readonly record: number }
  | {
      readonly code: "NOTHING_TO_PIN";
      readonly reason: NothingToPinReason;
      /** The line number asked for, when one was. */
      readonly line?: number;
    };

const FS_MESSAGES: Record<FsErrorCode, string> = {
  ENOENT: "No such file or directory",
  EACCES: "Permission denied",
  EPERM: "Operation not permitted",
  ENOTDIR: "Not a directory",
  EISDIR: "Is a directory",
  EEXIST: "File exists",
  ENOTEMPTY: "Directory not empty",
  ELOOP: "Too many levels of symbolic links",
  EINVAL: "Invalid argument",
  EBUSY: "Device or resource busy",
  EFBIG: "File too large",
};

/** The short system message for a filesystem error code: "No such file or directory". */
export const fsMessage = (code: FsErrorCode): string => FS_MESSAGES[code];

export function isFsError(error: SimError): error is FsError {
  return (FS_ERROR_CODES as readonly string[]).includes(error.code);
}

export function isUsageError(error: SimError): boolean {
  return (
    error.code === "BAD_FLAG" || error.code === "MISSING_ARGUMENT" || error.code === "BAD_ARGUMENT"
  );
}

/** Shell-style exit status: 127 for an unknown command, 2 for bad usage, 1 for anything else. */
export function exitCodeFor(error: SimError): number {
  if (error.code === "UNKNOWN_COMMAND") return 127;
  return isUsageError(error) ? 2 : 1;
}

/** The terse, realistic line a real terminal would print for this error. */
export function formatError(tool: string, error: SimError): string {
  switch (error.code) {
    case "UNKNOWN_COMMAND":
      return `${error.command}: command not found`;
    case "BAD_FLAG":
      // GNU tools word a single-letter option differently from a long one.
      return /^-[^-]$/.test(error.flag)
        ? `${tool}: invalid option -- '${error.flag.slice(1)}'`
        : `${tool}: unrecognized option '${error.flag}'`;
    case "MISSING_ARGUMENT":
      return error.argument.startsWith("-")
        ? `${tool}: option '${error.argument}' requires a value`
        : `${tool}: missing ${error.argument}`;
    case "BAD_ARGUMENT":
      return error.reason === "extra-argument"
        ? `${tool}: unexpected extra argument '${error.value}'`
        : `${tool}: invalid ${error.argument}: '${error.value}'`;
    case "HOST_NOT_FOUND":
      return `${tool}: ${error.target}: Name or service not known`;
    case "HOST_UNREACHABLE":
      return `${tool}: ${endpoint(error.target, error.port)}: Connection timed out (no reply)`;
    case "CONNECTION_REFUSED":
      return `${tool}: ${endpoint(error.target, error.port)}: Connection refused`;
    case "PROTOCOL_MISMATCH":
      return `${tool}: ${endpoint(error.target, error.port)}: expected ${error.expected}, got ${error.found}`;
    case "OUT_OF_SCOPE":
      return `${tool}: ${error.target}: outside the simulated network (nothing was sent)`;
    case "SUDO_DENIED":
      return `${tool}: ${error.user} is not in the sudoers file. This incident will be reported.`;
    case "NO_MANUAL_ENTRY":
      return `No manual entry for ${error.topic}`;
    case "EVIDENCE_NOT_LOADED":
      return `${tool}: no evidence is attached to this workstation`;
    case "NOT_EVIDENCE":
      return `${tool}: ${error.name}: not an evidence device or a disk image`;
    case "WRITE_TO_EVIDENCE":
      return `${tool}: ${error.path}: refusing to write onto the evidence device`;
    case "RECORD_NOT_FOUND":
      return `${tool}: ${error.image}: no record ${error.record} in this image`;
    case "CLUSTERS_REUSED":
      return `${tool}: ${error.image} record ${error.record}: those clusters hold something else now`;
    case "NOTHING_TO_PIN":
      return error.reason === "no-output"
        ? `${tool}: nothing has been printed yet to pin`
        : `${tool}: line ${error.line ?? 0} has nothing to pin`;
    default:
      return formatFsError(tool, error);
  }
}

function formatFsError(tool: string, error: FsError): string {
  switch (error.detail) {
    case "dot-path":
      return `${tool}: refusing to remove '.' or '..' directory: skipping '${error.path}'`;
    case "into-itself":
      return `${tool}: cannot put '${error.path}' inside itself`;
    case "omit-directory":
      return `${tool}: -r not specified; omitting directory '${error.path}'`;
    case "unknown-user":
      return `${tool}: invalid user: '${error.value ?? ""}'`;
    case "unknown-group":
      return `${tool}: invalid group: '${error.value ?? ""}'`;
    default:
      return `${tool}: ${error.path}: ${FS_MESSAGES[error.code]}`;
  }
}

const endpoint = (target: string, port: number | undefined) =>
  port === undefined ? target : `${target}:${port}`;
