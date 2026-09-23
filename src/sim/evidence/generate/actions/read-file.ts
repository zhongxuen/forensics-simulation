import type { ActionOf } from "../types";
import { touch, type ActionContext } from "../world";
import { requireFile } from "./shared";

/**
 * A file is opened and read. Only the accessed time moves, and only that — which is exactly why
 * an examiner works from a write-blocked copy. Opening the original for a quick look leaves this
 * same mark, and the image then no longer matches the hash on the handover form.
 */
export function applyReadFile(ctx: ActionContext, action: ActionOf<"read-file">): void {
  const { disk, file } = requireFile(ctx, action.path);
  touch(file, { a: ctx.recorded });
  ctx.note({
    kind: "file",
    image: disk.id,
    record: file.record,
    at: ctx.recorded,
    what: `the file ${action.path}, read`,
  });
}
