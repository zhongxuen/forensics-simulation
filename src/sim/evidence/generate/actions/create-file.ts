import type { ActionOf } from "../types";
import { diskOf, ensurePath, ownerFor, writeContent, type ActionContext } from "../world";
import { writingProcess } from "./shared";

/**
 * A file appears on the disk. Its four MACB times all start at the same instant, because it was
 * born, changed, written and read in the same moment. Anything above it that is missing (the
 * folder, and the folder above that) is created too.
 *
 * Leaves: the file record, and sysmon-lite 11.
 */
export function applyCreateFile(ctx: ActionContext, action: ActionOf<"create-file">): void {
  const disk = diskOf(ctx.machine, ctx.where);
  const owner = action.owner ?? ownerFor(ctx.machine, action.path);
  const file = ensurePath(disk, action.path, {
    at: ctx.recorded,
    owner,
    kind: "file",
    content: action.content ?? "",
  });
  // ensurePath hands back what is already there, so writing over an existing file still gets the
  // content the story asked for, with the times of a write rather than of a birth.
  if (action.content !== undefined && file.content.length === 0) {
    writeContent(disk, file, action.content, ctx.recorded);
  }

  const process = writingProcess(ctx);
  ctx.note({
    kind: "file",
    image: disk.id,
    record: file.record,
    at: ctx.recorded,
    what: `the file ${action.path}`,
  });
  ctx.log(
    "sysmon-lite",
    { ProcessId: String(process.pid), Image: process.path, TargetFilename: action.path },
    { eventId: 11, what: `${action.path} was created` },
  );
}
