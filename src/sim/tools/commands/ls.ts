import { paint, SGR } from "../../core/ansi";
import { columns, errorLineText, formatArgv, stdout } from "../../core/output";
import { fsMessage, type FsError } from "../../core/errors";
import { sessionFs } from "../../core/session";
import type { OutputLine, SimResult, SimState } from "../../core/types";
import { formatMode } from "../../fs/mode";
import { listDir, stat, type FsContext } from "../../fs/ops";
import type { StatInfo, Vfs } from "../../fs/types";
import { hasSwitch, parseArgs } from "../args";
import type { Tool, ToolContext } from "../types";
import { humanSize, lsTime, usage } from "./shared";

const NAME = "ls";
/** Assumed screen width for laying names out in columns. */
const SCREEN_WIDTH = 80;
const MAX_DEPTH = 32;

type ColorWhen = "auto" | "always" | "never";

interface Options {
  readonly all: boolean;
  readonly almostAll: boolean;
  readonly long: boolean;
  readonly human: boolean;
  readonly directory: boolean;
  readonly onePerLine: boolean;
  readonly classify: boolean;
  readonly reverse: boolean;
  readonly byTime: boolean;
  readonly bySize: boolean;
  readonly recursive: boolean;
  readonly color: boolean;
  readonly tty: boolean;
}

/** An entry to show, with the name to print (which may differ from the path, like "." or ".."). */
interface Entry {
  readonly name: string;
  readonly info: StatInfo;
}

export const ls: Tool = {
  name: NAME,
  category: "look-around",
  help: {
    oneLiner: "list what's in a folder, like opening it in a file browser.",
    usage: ["ls [options] [folder or file...]"],
    description: [
      "ls shows the files and folders inside the folder you're in. Give it a path to look somewhere else: ls /etc lists the folder called etc at the top of the computer.",
      "Names that start with a dot are hidden files. They're ordinary files, kept out of the way because they usually hold settings. ls leaves them out unless you add -a.",
      "The long format (-l) adds a row of details for each item. The first column, like -rw-r--r--, is the item's permissions: who may read (r), change (w), or run (x) it. The first letter is d for a folder and - for a file. Then come the number of links, the owner, the group, the size in bytes, and the time it last changed.",
    ],
    options: [
      {
        flags: "-a, --all",
        text: "Show hidden files too, including . (this folder) and .. (the folder above).",
      },
      { flags: "-A, --almost-all", text: "Show hidden files, but not . and .." },
      { flags: "-l", text: "Long format: permissions, owner, group, size and time for each item." },
      { flags: "-h, --human-readable", text: "With -l, show sizes like 4.0K instead of 4096." },
      { flags: "-d, --directory", text: "Show a folder itself, not what's inside it." },
      {
        flags: "-R, --recursive",
        text: "Also list every folder inside, and every folder inside those.",
      },
      { flags: "-t", text: "Newest first." },
      { flags: "-S", text: "Biggest first." },
      { flags: "-r, --reverse", text: "Reverse the order." },
      {
        flags: "-F, --classify",
        text: "Mark folders with /, programs with * and shortcuts with @.",
      },
      { flags: "-1", text: "One name per line." },
      {
        flags: "--color[=when]",
        text: "Colour folders and programs: auto (on screen only), always, or never.",
      },
    ],
    examples: [
      { command: "ls", text: "List the folder you're in." },
      { command: "ls -a", text: "Include hidden files, the ones whose names start with a dot." },
      { command: "ls -l /etc", text: "Show the details of everything in /etc." },
      {
        command: "ls -la ~",
        text: "Everything in your home folder, hidden files included, with details.",
      },
    ],
    concept: [
      "Looking around is the first step of any investigation. Security testers list folders to learn what a computer holds, and defenders do the same to spot files that shouldn't be there.",
      "The permissions column is where many real problems show up: a password file anyone can read, or a program anyone can change. ls -l is how you see them, and fixing them (with chmod) is one of the most useful things a defender does.",
    ],
  },

  run(args, state, ctx) {
    let color: ColorWhen = "auto";
    const rest: string[] = [];
    for (const arg of args) {
      const match = /^--colou?r(?:=(.*))?$/.exec(arg);
      if (!match) {
        rest.push(arg);
        continue;
      }
      const when = match[1] ?? "always";
      if (when !== "auto" && when !== "always" && when !== "never") {
        return usage(
          NAME,
          { code: "BAD_ARGUMENT", argument: "--color", value: when, reason: "unknown-value" },
          state,
        );
      }
      color = when;
    }
    const parsed = parseArgs(rest, [
      { names: ["-a", "--all"], key: "all" },
      { names: ["-A", "--almost-all"], key: "almostAll" },
      { names: ["-l"], key: "long" },
      { names: ["-h", "--human-readable"], key: "human" },
      { names: ["-d", "--directory"], key: "directory" },
      { names: ["-1"], key: "onePerLine" },
      { names: ["-F", "--classify"], key: "classify" },
      { names: ["-r", "--reverse"], key: "reverse" },
      { names: ["-t"], key: "byTime" },
      { names: ["-S"], key: "bySize" },
      { names: ["-R", "--recursive"], key: "recursive" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const on = (key: string) => hasSwitch(parsed.value, key);
    const options: Options = {
      all: on("all"),
      almostAll: on("almostAll"),
      long: on("long"),
      human: on("human"),
      directory: on("directory"),
      onePerLine: on("onePerLine"),
      classify: on("classify"),
      reverse: on("reverse"),
      byTime: on("byTime"),
      bySize: on("bySize"),
      recursive: on("recursive") && !on("directory"),
      color: color === "always" || (color === "auto" && ctx.tty),
      tty: ctx.tty,
    };
    return list(parsed.value.positionals, options, state, ctx);
  },
};

function list(
  operands: readonly string[],
  options: Options,
  state: SimState,
  ctx: ToolContext,
): SimResult {
  const { vfs, ctx: fsCtx } = sessionFs(state, ctx.now);
  const targets = operands.length > 0 ? operands : ["."];
  const output: OutputLine[] = [];
  let exitCode = 0;

  const files: Entry[] = [];
  const dirs: { name: string; path: string }[] = [];
  for (const target of targets) {
    // A shortcut (symbolic link) to a folder is followed, unless you asked for details (-l) or
    // for the item itself (-d). A shortcut to nothing is still shown, as itself.
    const follow = !options.long && !options.directory;
    let info = stat(vfs, fsCtx, target, { follow });
    if (!info.ok && follow && info.error.code === "ENOENT") {
      info = stat(vfs, fsCtx, target, { follow: false });
    }
    if (!info.ok) {
      output.push(accessError(info.error, "cannot access"));
      exitCode = 2;
      continue;
    }
    if (info.value.kind === "dir" && !options.directory) dirs.push({ name: target, path: target });
    else files.push({ name: target, info: info.value });
  }

  const blocks: OutputLine[][] = [];
  if (files.length > 0) blocks.push(format(sortEntries(files, options), options, ctx.now, false));
  const headers = targets.length > 1 || options.recursive;

  const visit = (name: string, path: string, depth: number) => {
    const listing = listDir(vfs, fsCtx, path);
    if (!listing.ok) {
      blocks.push([accessError({ ...listing.error, path: name }, "cannot open directory")]);
      exitCode = exitCode || 2;
      return;
    }
    const entries: Entry[] = listing.value
      .filter((info) => options.all || options.almostAll || !info.name.startsWith("."))
      .map((info) => ({ name: info.name, info }));
    if (options.all) {
      const self = stat(vfs, fsCtx, path);
      const parent = stat(vfs, fsCtx, `${path.replace(/\/+$/, "")}/..`);
      if (self.ok) entries.push({ name: ".", info: self.value });
      if (parent.ok) entries.push({ name: "..", info: parent.value });
    }
    const sorted = sortEntries(entries, options);
    const lines = format(sorted, options, ctx.now, true, vfs, fsCtx);
    blocks.push(headers ? [stdout(`${name}:`), ...lines] : lines);
    if (options.recursive && depth < MAX_DEPTH) {
      for (const entry of sorted) {
        if (entry.name === "." || entry.name === ".." || entry.info.kind !== "dir") continue;
        const child = `${name.replace(/\/+$/, "")}/${entry.name}`;
        visit(child, child, depth + 1);
      }
    }
  };
  for (const dir of sortNames(dirs, options)) visit(dir.name, dir.path, 0);

  blocks.forEach((block, i) => {
    if (i > 0) output.push(stdout(""));
    output.push(...block);
  });
  return { state, output, events: [], exitCode };
}

function accessError(error: FsError, verb: string): OutputLine {
  return errorLineText(`${NAME}: ${verb} '${error.path}': ${fsMessage(error.code)}`, error);
}

/** Case-insensitive, ignoring a leading dot, like ls in a normal (not "C") locale. */
function compareListNames(a: string, b: string): number {
  const key = (name: string) => name.replace(/^\.+/, "").toLowerCase();
  const ka = key(a);
  const kb = key(b);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortEntries(entries: readonly Entry[], options: Options): Entry[] {
  const sorted = [...entries].sort((a, b) => {
    if (options.byTime && a.info.mtime !== b.info.mtime) return b.info.mtime - a.info.mtime;
    if (options.bySize && a.info.size !== b.info.size) return b.info.size - a.info.size;
    return compareListNames(a.name, b.name);
  });
  return options.reverse ? sorted.reverse() : sorted;
}

function sortNames<T extends { name: string }>(items: readonly T[], options: Options): T[] {
  const sorted = [...items].sort((a, b) => compareListNames(a.name, b.name));
  return options.reverse ? sorted.reverse() : sorted;
}

const isExecutable = (info: StatInfo) => info.kind === "file" && (info.mode & 0o111) !== 0;

function decorate(entry: Entry, options: Options): { plain: string; shown: string } {
  let name = entry.name;
  if (options.tty && name !== formatArgv([name]) && name !== "." && name !== "..") {
    name = formatArgv([name]); // names with spaces get quotes, so you can type them back
  }
  const { info } = entry;
  let code: string | undefined;
  if (info.kind === "dir") code = SGR.directory;
  else if (info.kind === "symlink") code = SGR.symlink;
  else if (isExecutable(info)) code = SGR.executable;
  const mark = !options.classify
    ? ""
    : info.kind === "dir"
      ? "/"
      : info.kind === "symlink"
        ? "@"
        : isExecutable(info)
          ? "*"
          : "";
  const shown = options.color && code ? paint(code, name) : name;
  return { plain: `${name}${mark}`, shown: `${shown}${mark}` };
}

function format(
  entries: readonly Entry[],
  options: Options,
  now: number,
  isListing: boolean,
  vfs?: Vfs,
  fsCtx?: FsContext,
): OutputLine[] {
  if (options.long) return longFormat(entries, options, now, isListing, vfs, fsCtx);
  const names = entries.map((entry) => decorate(entry, options));
  if (names.length === 0) return [];
  if (options.onePerLine || !options.tty) return names.map((name) => stdout(name.shown));
  return grid(names).map(stdout);
}

/** Lays names out in columns, filled top to bottom, as wide as the screen allows. */
function grid(names: readonly { plain: string; shown: string }[]): string[] {
  const gap = 2;
  for (let cols = names.length; cols >= 1; cols--) {
    const rows = Math.ceil(names.length / cols);
    const widths: number[] = [];
    for (let c = 0; c < cols; c++) {
      const column = names.slice(c * rows, c * rows + rows);
      if (column.length === 0) continue;
      widths.push(Math.max(...column.map((name) => name.plain.length)));
    }
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
    if (total > SCREEN_WIDTH && cols > 1) continue;
    const lines: string[] = [];
    for (let r = 0; r < rows; r++) {
      let line = "";
      for (let c = 0; c < widths.length; c++) {
        const name = names[c * rows + r];
        if (!name) continue;
        const isLast = c === widths.length - 1 || !names[(c + 1) * rows + r];
        line += isLast
          ? name.shown
          : name.shown + " ".repeat((widths[c] ?? 0) - name.plain.length + gap);
      }
      lines.push(line);
    }
    return lines;
  }
  return names.map((name) => name.shown);
}

function longFormat(
  entries: readonly Entry[],
  options: Options,
  now: number,
  isListing: boolean,
  vfs?: Vfs,
  fsCtx?: FsContext,
): OutputLine[] {
  const linkCount = (entry: Entry): number => {
    if (entry.info.kind !== "dir" || !vfs || !fsCtx) return 1;
    const listing = listDir(vfs, fsCtx, entry.info.path);
    return 2 + (listing.ok ? listing.value.filter((child) => child.kind === "dir").length : 0);
  };
  const rows = entries.map((entry) => {
    const { info } = entry;
    const name = decorate(entry, options);
    const target = info.kind === "symlink" && info.target !== undefined ? ` -> ${info.target}` : "";
    return [
      formatMode(info.kind, info.mode),
      String(linkCount(entry)),
      info.owner,
      info.group,
      options.human ? humanSize(info.size) : String(info.size),
      lsTime(info.mtime, now),
      `${name.shown}${target}`,
    ];
  });
  // Numbers line up on the right, like the real thing.
  const width = (i: number) => Math.max(0, ...rows.map((row) => (row[i] ?? "").length));
  const aligned = rows.map((row) =>
    row.map((cell, i) => (i === 1 || i === 4 ? cell.padStart(width(i)) : cell)),
  );
  const lines = columns(aligned, 1).map(stdout);
  if (!isListing) return lines;
  const blocks = entries.reduce(
    (sum, entry) =>
      sum +
      (entry.info.kind === "dir"
        ? 4
        : entry.info.kind === "file"
          ? Math.ceil(entry.info.size / 4096) * 4
          : 0),
    0,
  );
  return [stdout(`total ${blocks}`), ...lines];
}
