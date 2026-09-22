import { paint, SGR } from "../../core/ansi";
import { errorLineText, plural, stdout } from "../../core/output";
import { fsMessage } from "../../core/errors";
import { sessionFs } from "../../core/session";
import type { OutputLine } from "../../core/types";
import { listDir, stat } from "../../fs/ops";
import { hasSwitch, optionValue, parseArgs } from "../args";
import type { Tool } from "../types";
import { usage, wholeNumber } from "./shared";

const NAME = "tree";
const MAX_DEPTH = 32;
const MAX_LINES = 2000;

export const tree: Tool = {
  name: NAME,
  category: "look-around",
  help: {
    oneLiner: "draw a folder and everything inside it as a tree, to see the whole layout at once.",
    usage: ["tree [options] [folder...]"],
    description: [
      "tree lists a folder, then every folder inside it, and so on, drawn with lines so you can see what sits inside what. At the end it counts the folders and files it found.",
      "Like ls, it leaves out hidden files (names starting with a dot) unless you add -a. On a big folder the tree can be long: -L 2 stops after two levels.",
    ],
    options: [
      { flags: "-a", text: "Include hidden files." },
      { flags: "-d", text: "Show folders only." },
      { flags: "-L <levels>", text: "Only go this many folders deep." },
    ],
    examples: [
      { command: "tree", text: "Draw the folder you're in and everything under it." },
      { command: "tree -L 1 /", text: "Show the folders at the very top of the computer." },
      { command: "tree -a ~", text: "Your home folder, hidden files included." },
    ],
    concept: [
      "Seeing the shape of a folder quickly tells you where to look. When a security tester lands on a new computer, a tree of the home folders or a web server's folder shows at a glance where the interesting files are.",
      "Folders you aren't allowed to open show up with an error instead of their contents. That's the computer's permissions keeping their contents private.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-a"], key: "all" },
      { names: ["-d"], key: "dirsOnly" },
      { names: ["-L"], key: "level", takesValue: true },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const levelText = optionValue(parsed.value, "level");
    const level = levelText === undefined ? MAX_DEPTH : wholeNumber(levelText, MAX_DEPTH);
    if (level === undefined || level === 0) {
      return usage(
        NAME,
        { code: "BAD_ARGUMENT", argument: "-L", value: levelText ?? "", reason: "out-of-range" },
        state,
      );
    }
    const all = hasSwitch(parsed.value, "all");
    const dirsOnly = hasSwitch(parsed.value, "dirsOnly");
    const { vfs, ctx: fsCtx } = sessionFs(state, ctx.now);
    const roots = parsed.value.positionals.length > 0 ? parsed.value.positionals : ["."];
    const output: OutputLine[] = [];
    let dirs = 0;
    let files = 0;
    let exitCode = 0;
    const paintDir = (name: string) => (ctx.tty ? paint(SGR.directory, name) : name);

    const walk = (path: string, prefix: string, depth: number) => {
      const listing = listDir(vfs, fsCtx, path);
      if (!listing.ok) return;
      // Shortcuts (symbolic links) are shown with their target but never followed, so a loop
      // of shortcuts can't make the tree go on forever.
      const entries = listing.value.filter(
        (entry) => (all || !entry.name.startsWith(".")) && (!dirsOnly || entry.kind === "dir"),
      );
      entries.forEach((entry, i) => {
        if (output.length >= MAX_LINES) return;
        const last = i === entries.length - 1;
        const isDir = entry.kind === "dir";
        const link =
          entry.kind === "symlink" && entry.target !== undefined ? ` -> ${entry.target}` : "";
        const shown = isDir ? paintDir(entry.name) : entry.name;
        const locked = isDir && !listDir(vfs, fsCtx, entry.path).ok;
        output.push(
          stdout(
            `${prefix}${last ? "└── " : "├── "}${shown}${link}${locked ? "  [error opening dir]" : ""}`,
          ),
        );
        if (isDir) dirs++;
        else files++;
        if (isDir && !locked && depth + 1 < level) {
          walk(entry.path, `${prefix}${last ? "    " : "│   "}`, depth + 1);
        }
      });
    };

    for (const root of roots) {
      const info = stat(vfs, fsCtx, root);
      if (!info.ok) {
        output.push(
          errorLineText(`${root} [error opening dir: ${fsMessage(info.error.code)}]`, {
            ...info.error,
            path: root,
          }),
        );
        exitCode = 2;
        continue;
      }
      if (info.value.kind !== "dir") {
        output.push(stdout(`${root}  [error opening dir]`));
        continue;
      }
      output.push(stdout(paintDir(root)));
      const listing = listDir(vfs, fsCtx, root);
      if (!listing.ok) {
        output.push(
          errorLineText(`${root} [error opening dir: ${fsMessage(listing.error.code)}]`, {
            ...listing.error,
            path: root,
          }),
        );
        exitCode = 2;
        continue;
      }
      walk(root, "", 0);
    }
    if (output.length >= MAX_LINES) output.push(stdout("... (cut short: use -L to go less deep)"));
    output.push(
      stdout(""),
      stdout(
        dirsOnly
          ? plural(dirs, "directory", "directories")
          : `${plural(dirs, "directory", "directories")}, ${plural(files, "file")}`,
      ),
    );
    return { state, output, events: [], exitCode };
  },
};
