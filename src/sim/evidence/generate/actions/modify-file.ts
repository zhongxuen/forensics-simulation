import type { ActionOf } from "../types";
import { writeContent, type ActionContext } from "../world";
import { requireFile } from "./shared";

/**
 * A file is written to. Its modified, accessed and changed times move to now; the born time does
 * not, which is how an examiner tells a file that was edited from one that was just made.
 *
 * None of the six log sources records an ordinary save, so the times on the disk are the whole
 * artefact. That is worth noticing: plenty of what happens on a machine is never logged anywhere.
 */
export function applyModifyFile(ctx: ActionContext, action: ActionOf<"modify-file">): void {
  const { disk, file } = requireFile(ctx, action.path);
  if (action.content !== undefined && action.append !== undefined) {
    ctx.fail("use content to replace what the file says, or append to add to it, not both.");
  }
  const decoder = new TextDecoder();
  const text =
    action.append !== undefined
      ? decoder.decode(file.content) + action.append
      : (action.content ?? decoder.decode(file.content));
  writeContent(disk, file, text, ctx.recorded);
  ctx.note({
    kind: "file",
    image: disk.id,
    record: file.record,
    at: ctx.recorded,
    what: `the changed file ${action.path}`,
  });
}
