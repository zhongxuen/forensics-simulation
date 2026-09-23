import type { ActionOf } from "../types";
import { createRecord, diskOf, ownerFor, recordsAt, toBytes, type ActionContext } from "../world";

/**
 * The clusters a deleted file left behind are taken over by something else. This is what makes
 * "deleted" finally mean gone: the record still says where the file was, but what is there now
 * belongs to another file, so recovering it gives back the wrong bytes.
 *
 * The copy in unallocated space is written over too, so carving finds nothing either. Without this
 * action a deleted file in a case stays recoverable, which is usually what a case wants.
 */
export function applyOverwriteClusters(
  ctx: ActionContext,
  action: ActionOf<"overwrite-clusters">,
): void {
  const disk = diskOf(ctx.machine, ctx.where);
  const deleted = recordsAt(disk, action.path).find((record) => record.deleted);
  if (!deleted) {
    ctx.fail(
      `nothing deleted is at ${action.path} on ${ctx.machine.id}, so there are no clusters to reuse. Delete it earlier in the story.`,
    );
  }

  const path = action.by ?? `${ctx.machine.baseline.programFolder}\\temp-${deleted.record}.tmp`;
  const filler = action.content ?? "\u0000".repeat(Math.max(1, deleted.content.length));
  const taken = createRecord(disk, path, {
    at: ctx.recorded,
    owner: ownerFor(ctx.machine, path),
    kind: "file",
    content: filler,
  });
  // The new file sits exactly where the old one did, which is the whole point of the action.
  taken.clusters = [...deleted.clusters];

  const chunk = deleted.unallocatedChunk;
  const was = chunk === undefined ? undefined : disk.unallocated[chunk];
  if (chunk !== undefined && was) {
    const over = toBytes(filler);
    disk.unallocated[chunk] = new Uint8Array(
      Array.from({ length: was.length }, (_, i) =>
        over.length === 0 ? 0 : (over[i % over.length] ?? 0),
      ),
    );
  }

  ctx.note({
    kind: "file",
    image: disk.id,
    record: taken.record,
    at: ctx.recorded,
    what: `the file that took over ${action.path}'s clusters`,
  });
}
