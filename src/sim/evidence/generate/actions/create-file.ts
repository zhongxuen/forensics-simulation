import type { ActionOf } from "../types";
import {
  diskOf,
  ensurePath,
  liveRecord,
  ownerFor,
  writeContent,
  type ActionContext,
} from "../world";
import { writingProcess } from "./shared";

/**
 * A file appears on the disk. Its four MACB times all start at the same instant, because it was
 * born, changed, written and read in the same moment. Anything above it that is missing (the
 * folder, and the folder above that) is created too.
 *
 * Saving over a file that is already there is the same action again, and it behaves the way a save
 * does: the content becomes whatever the story said, and modified, accessed and changed move to
 * this instant while **born** stays where it was. Leaving the times alone instead would make the
 * record disagree with the story that wrote it, which is what `tests/content/case-consistency`
 * checks for — and the background activity a case generates picks its file names from a short
 * list, so the same name does come round twice.
 *
 * Leaves: the file record, and sysmon-lite 11.
 */
export function applyCreateFile(ctx: ActionContext, action: ActionOf<"create-file">): void {
  const disk = diskOf(ctx.machine, ctx.where);
  const owner = action.owner ?? ownerFor(ctx.machine, action.path);
  const existing = liveRecord(disk, action.path);
  const file =
    existing ??
    ensurePath(disk, action.path, {
      at: ctx.recorded,
      owner,
      kind: "file",
      content: action.content ?? "",
    });
  // A save over something already on the disk. With no content in the story, the file keeps what
  // it had and only its times move.
  if (existing && existing.kind !== "dir") {
    writeContent(disk, file, action.content ?? file.content, ctx.recorded);
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
