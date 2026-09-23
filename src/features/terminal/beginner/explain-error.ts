/**
 * Friendly explainer lines (improvement #16): each engine error code and parse error code, in
 * plain words, following md-files/voice-and-tone.md. The realistic error line comes first; this
 * is the dim line underneath that says what it means and what to try next.
 *
 * `Record<SimErrorCode, …>` makes TypeScript refuse to compile if a code has no copy, and
 * tests/unit/terminal-beginner.test.ts checks every one renders, with no banned words. Text in
 * `backticks` is something to type or a name, shown highlighted.
 */
import type { FsError, SimError, SimErrorCode } from "@/sim/types";
import type { ParseError, ParseErrorCode } from "../parser";

export interface ExplainContext {
  /** The command that reported the error, like "cat". */
  readonly command: string;
  /** The session's account, like "recruit". */
  readonly user: string;
  /** The folder the terminal is in. */
  readonly cwd: string;
  /** A real name close to what was typed: a command for UNKNOWN_COMMAND, a path for ENOENT. */
  readonly suggestion?: string;
  /** The suggestion's one-line summary, for commands. */
  readonly suggestionSummary?: string;
}

/** Commands that only read, so a permission problem is about reading. */
const READERS = new Set([
  "cat",
  "less",
  "head",
  "tail",
  "grep",
  "wc",
  "sort",
  "uniq",
  "cut",
  "sed",
  "logview",
  "hashid",
  "file",
  "stat",
]);
/** Commands that change things, so a permission problem is about changing. */
const WRITERS = new Set(["touch", "mkdir", "rm", "cp", "mv", "bash", "echo", "sed"]);

function permissionCopy(error: FsError, ctx: ExplainContext): string {
  const path = error.path;
  if (/(^|\/)shadow$/.test(path)) {
    return "This file stores password hashes (scrambled passwords), so only the admin account, called `root`, can read it. That's a good protection, not a mistake on your part.";
  }
  if (/^\/root(\/|$)/.test(path)) {
    return "`/root` is the admin account's home folder, and it's locked to everyone else. That's the lock doing its job.";
  }
  const home = /^\/home\/([^/]+)/.exec(path);
  if (home && home[1] !== ctx.user) {
    return `That's inside ${home[1]}'s home folder. Home folders are private to their owner, so your account (\`${ctx.user}\`) can't look inside.`;
  }
  if (path.startsWith("/var/log") && READERS.has(ctx.command)) {
    return "Some logs can only be read by the admin or by the `adm` group, because they can hold private details. Type `ls -l /var/log` to see which ones you can read.";
  }
  const action = READERS.has(ctx.command)
    ? "read"
    : WRITERS.has(ctx.command)
      ? "change"
      : ctx.command === "cd" || ctx.command === "ls" || ctx.command === "tree"
        ? "open"
        : "use";
  return `Your account (\`${ctx.user}\`) isn't allowed to ${action} \`${path}\`. Every file and folder has permissions, a lock that says who may read, change, or open it. Type \`ls -l\` on the folder it's in to see who may.`;
}

const FS_COPY: Readonly<Record<FsError["code"], (error: FsError, ctx: ExplainContext) => string>> =
  {
    ENOENT: (error, ctx) => {
      if (ctx.suggestion)
        return `There's nothing called \`${error.path}\`. Did you mean \`${ctx.suggestion}\`?`;
      return error.path.includes("/")
        ? `There's nothing at \`${error.path}\`. Check each part of the path: \`ls\` the folder it should be in to see the real names.`
        : `There's no file or folder called \`${error.path}\` in this folder. Names have to match exactly, including capital letters. Type \`ls\` to see what's here.`;
    },
    EACCES: permissionCopy,
    EPERM: (error, ctx) => {
      if (error.detail === "sticky") {
        return "In shared folders like `/tmp`, only a file's owner can delete or rename it, even though everyone can add files there. That keeps people's files safe from each other.";
      }
      if (ctx.command === "hostname")
        return "Only the admin account (`root`) can change the computer's name.";
      return `Only the owner of \`${error.path}\`, or the admin account (\`root\`), can do that. Type \`ls -l\` to see who owns it.`;
    },
    ENOTDIR: (error) =>
      `\`${error.path}\` is a file, not a folder, so you can't go into it or list what's inside. Use \`cat\` to read a file, and \`cd\` or \`ls\` for folders.`,
    EISDIR: (error, ctx) => {
      if (error.detail === "omit-directory") {
        return `\`${error.path}\` is a folder. To copy a folder and everything in it, add -r: \`cp -r ${error.path} …\`.`;
      }
      if (ctx.command === "rm") {
        return `\`${error.path}\` is a folder. \`rm -r ${error.path}\` deletes it and everything inside it, so check with \`ls ${error.path}\` first.`;
      }
      return `\`${error.path}\` is a folder, not a file. To see what's inside a folder, type \`ls ${error.path}\`.`;
    },
    EEXIST: (error) =>
      `There's already something called \`${error.path}\` here. Pick another name, or type \`ls\` to see what's there.`,
    ENOTEMPTY: (error) =>
      `\`${error.path}\` still has things inside, so it can't be replaced. Empty it first, or pick another name.`,
    ELOOP: (error) =>
      `\`${error.path}\` is a shortcut (a symbolic link) that leads to another shortcut, and round again: a loop with no real file at the end. Type \`ls -l\` to see where each one points.`,
    EINVAL: (error) => {
      switch (error.detail) {
        case "dot-path":
          return "`.` means this folder and `..` means the one above it. rm won't delete them, to stop accidents.";
        case "into-itself":
          return "A folder can't go inside itself: the copy would never end. Pick a destination outside it.";
        case "bad-name":
          return "File names can't be empty, and can't contain a `/` (that separates folders).";
        case "unknown-user":
          return `There's no account called \`${error.value ?? error.path}\` on this computer. Type \`cat /etc/passwd\` to see the accounts.`;
        case "unknown-group":
          return `There's no group called \`${error.value ?? error.path}\` on this computer. Type \`cat /etc/group\` to see the groups.`;
        default:
          return "The computer couldn't make sense of that request. Check the command's guide with `man` and its name.";
      }
    },
    EBUSY: () =>
      "`rm` refuses to delete `/`, the root folder at the top of the whole computer. In real life, that would wipe everything. Here, even if it did, Reset machine would bring it all back.",
    EFBIG: () =>
      "That would make a file too big for this practice computer. It usually means a command is copying a file into itself.",
  };

const OTHER_COPY: {
  readonly [C in Exclude<SimErrorCode, FsError["code"]>]: (
    error: Extract<SimError, { code: C }>,
    ctx: ExplainContext,
  ) => string;
} = {
  UNKNOWN_COMMAND: (error, ctx) => {
    if (ctx.suggestion) {
      const about = ctx.suggestionSummary
        ? ` (it'll ${ctx.suggestionSummary.replace(/\.$/, "")})`
        : "";
      return `There's no command called \`${error.command}\`. Did you mean \`${ctx.suggestion}\`?${about}`;
    }
    return `There's no command called \`${error.command}\` here. Command names have to be exact. Type \`help\` to see the ones you can use.`;
  },
  BAD_FLAG: (error, ctx) =>
    `\`${ctx.command}\` doesn't have a \`${error.flag}\` option. Options have to match exactly, capital letters included. Type \`${ctx.command} --help\` to see the ones it has.`,
  MISSING_ARGUMENT: (error, ctx) => {
    if (error.argument === "OLDPWD") {
      return "There's no previous folder to go back to yet. `cd -` works once you've moved at least once.";
    }
    if (error.argument === "page")
      return "`man` needs the name of a command after it, like `man ls`.";
    if (error.argument.includes("file operand")) {
      return `\`${ctx.command}\` needs a file name after it, like \`${ctx.command} notes.txt\`. Type \`ls\` to see the files here.`;
    }
    if (error.argument.includes("destination")) {
      return `\`${ctx.command}\` needs two names: what to copy or move, then where it goes, like \`${ctx.command} notes.txt backup.txt\`.`;
    }
    return `\`${ctx.command}\` needs more after it (${error.argument}). Type \`${ctx.command} --help\` to see examples.`;
  },
  BAD_ARGUMENT: (error, ctx) => {
    if (error.argument === "redirect") {
      return "The file name after `>` matched several files, so the computer can't tell which one to write to. Use one exact name.";
    }
    switch (error.reason) {
      case "extra-argument":
        return `\`${ctx.command}\` got more than it expected: \`${error.value}\` is one too many. If a name has spaces in it, put it in quotes, like 'my file.txt'.`;
      case "out-of-range":
        return `\`${error.value}\` is outside what ${error.argument} allows.${error.argument.includes("port") ? " Ports go from 1 to 65535." : ""} Type \`${ctx.command} --help\` to see what fits.`;
      case "range-too-large":
        return "That range covers too many addresses to scan at once. Try a /24, like `10.0.1.0/24`: that's 256 addresses.";
      case "too-long":
        return `That's longer than \`${ctx.command}\` accepts. Try something shorter.`;
      case "unknown-value":
        return `\`${error.value}\` isn't one of the choices for ${error.argument}. Type \`${ctx.command} --help\` to see them.`;
      default:
        return `\`${error.value}\` isn't in the form \`${ctx.command}\` expects for ${error.argument}. Type \`${ctx.command} --help\` to see examples.`;
    }
  },
  HOST_NOT_FOUND: (error) =>
    `No computer on this network is called \`${error.target}\`. Names have to match exactly. Try its address instead.`,
  HOST_UNREACHABLE: (error) =>
    `The computer at \`${error.target}\` didn't answer. It might be switched off, a firewall (a set of rules about who may talk to whom) might be blocking you, or it might ignore "are you there?" messages, called pings.`,
  CONNECTION_REFUSED: (error) =>
    `The computer at \`${error.target}\` answered, but nothing is listening on port ${error.port}: that door is shut.`,
  PROTOCOL_MISMATCH: (error) =>
    `Port ${error.port} is open, but the program behind it speaks ${error.found}, not ${error.expected}. Web pages usually live on port 80 or 443.`,
  OUT_OF_SCOPE: (error) =>
    `\`${error.target}\` is outside the practice network, so nothing was sent. This simulation only works with its own made-up computers, and real security testers only test what they have written permission to test.`,
  SUDO_DENIED: () =>
    "Your account isn't allowed to act as the admin (`root`) on this computer. That's a good protection: only trusted accounts get admin powers. On a real computer the attempt would be written to the security log.",
  NO_MANUAL_ENTRY: (error) =>
    `There's no manual page called \`${error.topic}\`. Manual pages are named after commands: type \`help\` to see them, then \`man\` and a name.`,
  EVIDENCE_NOT_LOADED: () =>
    "This workstation has no evidence attached to it yet. The disk tools work on a case's evidence, which arrives when you open a case. Open one from Cases, or try the commands in the sandbox.",
  NOT_EVIDENCE: (error) =>
    `\`${error.name}\` isn't a piece of evidence this workstation knows about. It has to be a device under \`/dev/evidence\`, a copy you made with \`acquire\`, or the name of one of those. Type \`blocker\` to see what's attached.`,
  WRITE_TO_EVIDENCE: (error) =>
    `\`${error.path}\` is on the evidence device, and nothing you do may write there: that's the one rule the whole job rests on. Pick somewhere in your own folders instead, like \`~/cases\`.`,
  RECORD_NOT_FOUND: (error) =>
    `There's no record ${error.record} in \`${error.image}\`. Every file and folder in an image has a record number; type \`lsfs ${error.image} -r\` to see the ones that exist.`,
  CLUSTERS_REUSED: (error) =>
    `Record ${error.record} in \`${error.image}\` was deleted, and something has since been written over the clusters its content was in, so those bytes are gone. The record is still evidence: \`inode ${error.image} ${error.record}\` shows the name, the size and the times.`,
  NOTHING_TO_PIN: (error) =>
    error.reason === "no-output"
      ? "Nothing has been printed yet for `pin` to look at. Run an evidence tool first, such as `lsfs` or `inode`, then pin one of the lines it prints."
      : "There's nothing on that line to pin. Pin a line that names a file, record, process or log entry.",
};

/** The beginner explanation for an engine error. */
export function explainError(error: SimError, ctx: ExplainContext): string {
  if (error.code in FS_COPY) return FS_COPY[error.code as FsError["code"]](error as FsError, ctx);
  const copy = OTHER_COPY[error.code as keyof typeof OTHER_COPY] as (
    error: SimError,
    ctx: ExplainContext,
  ) => string;
  return copy(error, ctx);
}

const OPERATOR_COPY: Readonly<Record<string, string>> = {
  "|": "The `|` symbol, a pipe, sends one command's output into another, so it needs a command on each side, like `cat notes.txt | grep day`.",
  "&&": "`&&` runs a second command only if the first one worked, so it needs a command on each side, like `cd logs && ls`.",
  "||": "`||` runs a second command only if the first one didn't work, so it needs a command on each side.",
  ";": "`;` separates two commands, so it needs a command before it.",
};

const PARSE_COPY: Readonly<Record<ParseErrorCode, (error: ParseError) => string>> = {
  UNTERMINATED_QUOTE: (error) =>
    `A quote mark (${error.token}) was opened at column ${error.column} but never closed, so the computer is still waiting for the rest. Add a matching ${error.token} at the end, or remove the one you started.`,
  UNEXPECTED_TOKEN: (error) =>
    OPERATOR_COPY[error.token] ??
    (error.token.startsWith("<") || error.token.startsWith(">")
      ? `\`${error.token}\` needs a file name after it, not another symbol.`
      : `The computer didn't expect \`${error.token}\` at column ${error.column}. Check the line around there.`),
  UNEXPECTED_END: (error) =>
    error.token === "newline"
      ? "`>` sends output into a file, so it needs a file name after it, like `ls > list.txt`."
      : error.token === "\\"
        ? "A backslash at the very end means the line carries on, but nothing followed. Remove it."
        : "The line ends with a symbol that needs another command after it. Add the next command, or delete the symbol.",
  BAD_SUBSTITUTION: () =>
    "`${…}` should hold a variable name, like `${HOME}`. Check the spelling inside the braces.",
  UNSUPPORTED_SYNTAX: () =>
    "That's real shell syntax, but this practice terminal keeps things simpler: commands, pipes (|), files (> and <), and && or ;. Try splitting it into separate commands.",
  LINE_TOO_LONG: () => "That line is too long for this terminal. Break it into shorter commands.",
};

/** The beginner explanation for a line that couldn't be parsed. */
export function explainParseError(error: ParseError): string {
  return PARSE_COPY[error.code](error);
}
