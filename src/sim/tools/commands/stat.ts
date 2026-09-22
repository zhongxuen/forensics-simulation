import { stdout } from "../../core/output";
import { sessionFs, sessionMachine } from "../../core/session";
import type { OutputLine } from "../../core/types";
import { formatMode, formatOctal } from "../../fs/mode";
import { stat as statPath } from "../../fs/ops";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { fsErrorLine, statTime, usage } from "./shared";

const NAME = "stat";

const KIND_NAMES = { file: "regular file", dir: "directory", symlink: "symbolic link" } as const;

export const stat: Tool = {
  name: NAME,
  category: "find",
  help: {
    oneLiner:
      "show everything the computer records about a file: size, owner, permissions and times.",
    usage: ["stat [options] file..."],
    description: [
      "stat prints a file's details, the information the computer keeps about it besides what's inside. That information is called metadata.",
      "The Access line shows the permissions twice: as a number like 0644 and as letters like -rw-r--r--. Each group of three letters is for one kind of account: the owner, the file's group, then everyone else. r means read, w means change (write), and x means run, or for a folder, enter.",
      "Uid and Gid are the owner's and group's numbers, with their names. Modify is when the contents last changed.",
    ],
    options: [
      {
        flags: "-L, --dereference",
        text: "For a shortcut (symbolic link), describe what it points to instead.",
      },
    ],
    examples: [
      { command: "stat notes.txt", text: "Everything recorded about notes.txt." },
      { command: "stat /etc/shadow", text: "See who owns the password file and who may read it." },
    ],
    concept: [
      "Metadata is evidence. The owner shows who a file belongs to, the permissions show who could read or change it, and the times help put events in order when working out what happened.",
      "You can see a locked file's metadata even when you can't read what's inside. That's often enough to spot a problem, like a secrets file that everyone is allowed to read.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [{ names: ["-L", "--dereference"], key: "follow" }]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const files = parsed.value.positionals;
    if (files.length === 0) {
      return usage(NAME, { code: "MISSING_ARGUMENT", argument: "operand" }, state);
    }
    const { vfs, ctx: fsCtx } = sessionFs(state, ctx.now);
    const { accounts } = sessionMachine(state);
    const idOf = (kind: "users" | "groups", name: string) => {
      const record = accounts[kind];
      const entry = Object.hasOwn(record, name) ? record[name] : undefined;
      return entry ? ("uid" in entry ? entry.uid : entry.gid) : 0;
    };
    const output: OutputLine[] = [];
    let failed = false;
    files.forEach((file, i) => {
      const info = statPath(vfs, fsCtx, file, { follow: hasSwitch(parsed.value, "follow") });
      if (!info.ok) {
        output.push(fsErrorLine(NAME, info.error, "cannot statx"));
        failed = true;
        return;
      }
      const v = info.value;
      if (i > 0 && output.length > 0) output.push(stdout(""));
      const shownName =
        v.kind === "symlink" && v.target !== undefined ? `${file} -> ${v.target}` : file;
      const blocks = v.kind === "dir" ? 8 : Math.ceil(v.size / 4096) * 8;
      output.push(
        stdout(`  File: ${shownName}`),
        stdout(
          `  Size: ${String(v.size).padEnd(10)} Blocks: ${String(blocks).padEnd(10)} IO Block: 4096   ${KIND_NAMES[v.kind]}`,
        ),
        stdout(
          `Access: (${formatOctal(v.mode)}/${formatMode(v.kind, v.mode)})  Uid: (${String(idOf("users", v.owner)).padStart(5)}/${v.owner.padStart(8)})   Gid: (${String(idOf("groups", v.group)).padStart(5)}/${v.group.padStart(8)})`,
        ),
        stdout(`Modify: ${statTime(v.mtime)}`),
        stdout(`Change: ${statTime(v.mtime)}`),
      );
    });
    return { state, output, events: [], exitCode: failed ? 1 : 0 };
  },
};
