import type { ActionOf } from "../types";
import { deleteRecord, type ActionContext } from "../world";
import { requireFile, writingProcess } from "./shared";

/**
 * A file is deleted. Deleting scrubs nothing: the record stays, marked deleted, with its clusters
 * still pointing at its content, and a copy of the bytes is left in unallocated space. So the file
 * is recoverable until something reuses those clusters (`overwrite-clusters`), and a carver can
 * find it in unallocated space even after that.
 *
 * Leaves: the deleted record, its bytes in unallocated space, and sysmon-lite 23.
 */
export function applyDeleteFile(ctx: ActionContext, action: ActionOf<"delete-file">): void {
  const { disk, file } = requireFile(ctx, action.path);
  const offset = deleteRecord(disk, file, ctx.recorded);
  const process = writingProcess(ctx);

  ctx.note({
    kind: "file",
    image: disk.id,
    record: file.record,
    at: ctx.recorded,
    what: `the deleted file ${action.path}`,
  });
  if (file.content.length > 0) {
    ctx.note({
      kind: "carve",
      image: disk.id,
      offset,
      at: ctx.recorded,
      what: `what is left of ${action.path} in unallocated space`,
    });
  }
  ctx.log(
    "sysmon-lite",
    {
      ProcessId: String(process.pid),
      Image: process.path,
      User: file.owner,
      TargetFilename: action.path,
    },
    { eventId: 23, what: `${action.path} was deleted` },
  );
}
