import { stdout } from "../../core/output";
import type { FsError } from "../../core/errors";
import { fileChanged, sessionFs, withSessionFs } from "../../core/session";
import type { OutputLine, SimEvent, SimResult, SimState } from "../../core/types";
import { cp as copy, mv as move, realpath, stat, type FsResult } from "../../fs/ops";
import type { Vfs } from "../../fs/types";
import { hasSwitch, parseArgs } from "../args";
import type { Tool, ToolContext } from "../types";
import { fsErrorLine, usage } from "./shared";

const NAME = "cp";

/**
 * cp and mv share their shape: one source and a destination, or several sources and a folder to
 * put them in.
 */
export function copyOrMove(
  tool: "cp" | "mv",
  args: readonly string[],
  state: SimState,
  ctx: ToolContext,
): SimResult {
  const parsed = parseArgs(args, [
    ...(tool === "cp" ? [{ names: ["-r", "-R", "--recursive"], key: "recursive" }] : []),
    { names: ["-v", "--verbose"], key: "verbose" },
    { names: ["-f", "--force"], key: "force" },
    { names: ["-n", "--no-clobber"], key: "noClobber" },
  ]);
  if (!parsed.ok) return usage(tool, parsed.error, state);
  const operands = parsed.value.positionals;
  if (operands.length === 0) {
    return usage(tool, { code: "MISSING_ARGUMENT", argument: "file operand" }, state);
  }
  if (operands.length === 1) {
    return usage(
      tool,
      { code: "MISSING_ARGUMENT", argument: `destination file operand after '${operands[0]}'` },
      state,
    );
  }
  const sources = operands.slice(0, -1);
  const destination = operands[operands.length - 1] as string;
  const { vfs: startVfs, ctx: startCtx } = sessionFs(state, ctx.now);
  const destInfo = stat(startVfs, startCtx, destination);
  if (sources.length > 1 && !(destInfo.ok && destInfo.value.kind === "dir")) {
    const error: FsError = { code: "ENOTDIR", path: destination };
    return { state, output: [fsErrorLine(tool, error, "target")], events: [], exitCode: 1 };
  }

  let next = state;
  const output: OutputLine[] = [];
  const events: SimEvent[] = [];
  let failed = false;
  for (const source of sources) {
    const { vfs, ctx: fsCtx } = sessionFs(next, ctx.now);
    const sourceInfo = stat(vfs, fsCtx, source, { follow: tool === "cp" });
    if (!sourceInfo.ok) {
      output.push(fsErrorLine(tool, sourceInfo.error, "cannot stat"));
      failed = true;
      continue;
    }
    const intoDir = destInfo.ok && destInfo.value.kind === "dir";
    const name = sourceInfo.value.name;
    const finalPath = intoDir ? `${destination.replace(/\/+$/, "")}/${name}` : destination;
    const existed = stat(vfs, fsCtx, finalPath).ok;
    if (existed && hasSwitch(parsed.value, "noClobber")) continue;
    const done: FsResult<Vfs> =
      tool === "cp"
        ? copy(vfs, fsCtx, source, destination, { recursive: hasSwitch(parsed.value, "recursive") })
        : move(vfs, fsCtx, source, destination);
    if (!done.ok) {
      output.push(fsErrorLine(tool, done.error, failureVerb(tool, done.error, source)));
      failed = true;
      continue;
    }
    next = withSessionFs(next, done.value);
    const landed = realpath(done.value, fsCtx, finalPath);
    if (landed.ok) {
      events.push(
        fileChanged(next, landed.value, tool === "mv" ? "moved" : existed ? "modified" : "created"),
      );
    }
    if (hasSwitch(parsed.value, "verbose")) {
      output.push(
        stdout(
          tool === "mv" ? `renamed '${source}' -> '${finalPath}'` : `'${source}' -> '${finalPath}'`,
        ),
      );
    }
  }
  return { state: next, output, events, exitCode: failed ? 1 : 0 };
}

/** How GNU cp and mv word each failure: "cannot stat", "cannot open", "cannot create". */
function failureVerb(tool: "cp" | "mv", error: FsError, source: string): string {
  if (error.path === source)
    return error.code === "EACCES" && tool === "cp" ? "cannot open" : "cannot stat";
  return tool === "cp" ? "cannot create" : "cannot move to";
}

export const cp: Tool = {
  name: NAME,
  category: "change",
  help: {
    oneLiner: "copy files or folders, leaving the originals where they are.",
    usage: ["cp [options] source destination", "cp [options] source... folder"],
    description: [
      "cp (copy) makes a copy of a file. The last name you give is where the copy goes: a new file name, or a folder to put the copy into.",
      "To copy a folder and everything inside it, add -r (recursive). The copy belongs to you, even if the original belonged to someone else, and it gets your own default permissions.",
    ],
    options: [
      { flags: "-r, -R, --recursive", text: "Copy folders and everything inside them." },
      { flags: "-n, --no-clobber", text: "Never overwrite a file that's already there." },
      { flags: "-v, --verbose", text: "Say each copy it makes." },
      { flags: "-f, --force", text: "Overwrite without asking (the default here)." },
    ],
    examples: [
      { command: "cp notes.txt notes-backup.txt", text: "Make a backup copy of notes.txt." },
      { command: "cp /var/log/syslog ~", text: "Copy the system log into your home folder." },
      { command: "cp -r reports reports-old", text: "Copy a whole folder." },
    ],
    concept: [
      "Investigators work on copies, never on the original evidence, so nothing they do can change what really happened. Keeping a careful record of who handled evidence and when is called the chain of custody.",
      "Copying a file you can read makes a copy anyone with access to the new place might read. Copying a secret into a shared folder is a real way secrets leak.",
    ],
  },

  run(args, state, ctx) {
    return copyOrMove(NAME, args, state, ctx);
  },
};
