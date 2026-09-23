import type { ActionOf } from "../types";
import { diskOf, ensurePath, ownerFor, writeContent, type ActionContext } from "../world";
import { writingProcess } from "./shared";

/**
 * Something is fetched from an address and saved. It is the same pair of artefacts every time: a
 * lookup of the name, then a brand-new file on the disk. Matching the two is how a case shows
 * where a program on a machine came from.
 *
 * Leaves: a dns record, the file, and sysmon-lite 11.
 */
export function applyDownload(ctx: ActionContext, action: ActionOf<"download">): void {
  const disk = diskOf(ctx.machine, ctx.where);
  const host = action.url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[/?#]/)[0] ?? action.url;

  ctx.log(
    "dns",
    { client: ctx.machine.ip, query: host, type: "A", rcode: "NOERROR" },
    { what: `a lookup of ${host}` },
  );

  const file = ensurePath(disk, action.path, {
    at: ctx.recorded,
    owner: ownerFor(ctx.machine, action.path),
    kind: "file",
    content: action.content ?? `Downloaded from ${action.url}\n`,
  });
  if (action.content !== undefined && file.content.length === 0) {
    writeContent(disk, file, action.content, ctx.recorded);
  }

  const process = writingProcess(ctx);
  ctx.note({
    kind: "file",
    image: disk.id,
    record: file.record,
    at: ctx.recorded,
    what: `${action.path}, downloaded from ${action.url}`,
  });
  ctx.log(
    "sysmon-lite",
    { ProcessId: String(process.pid), Image: process.path, TargetFilename: action.path },
    { eventId: 11, what: `${action.path} was written` },
  );
}
