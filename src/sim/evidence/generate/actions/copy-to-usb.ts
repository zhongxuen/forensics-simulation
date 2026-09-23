import type { ActionOf } from "../types";
import { baseName, createRecord, touch, type ActionContext, type DiskState } from "../world";
import { requireFile, writingProcess } from "./shared";

/**
 * A file is copied to a removable drive. Two machines' worth of evidence come out of one action:
 * the original's accessed time moves, because copying means reading, and a brand-new record with
 * all four times set to now appears on the drive.
 *
 * Leaves: the copy, the original's accessed time, and sysmon-lite 11.
 */
export function applyCopyToUsb(ctx: ActionContext, action: ActionOf<"copy-to-usb">): void {
  const { disk, file } = requireFile(ctx, action.path);
  const volumes = [...ctx.machine.volumes.entries()];
  const found: [string, DiskState] | undefined =
    action.device === undefined
      ? volumes[volumes.length - 1]
      : volumes.find(([, drive]) => drive.id === action.device);
  if (!found) {
    ctx.fail(
      action.device === undefined
        ? `no removable drive is plugged into ${ctx.machine.id}. Add a usb-insert action first.`
        : `no removable drive called "${action.device}" is plugged into ${ctx.machine.id}.`,
    );
  }
  const [letter, drive] = found;
  const to = action.to ?? `${letter}:\\${baseName(action.path)}`;

  touch(file, { a: ctx.recorded });
  const copy = createRecord(drive, to, {
    at: ctx.recorded,
    owner: file.owner,
    kind: "file",
    content: file.content,
  });

  const process = writingProcess(ctx);
  ctx.note({
    kind: "file",
    image: drive.id,
    record: copy.record,
    at: ctx.recorded,
    what: `the copy at ${to}`,
  });
  ctx.note({
    kind: "file",
    image: disk.id,
    record: file.record,
    at: ctx.recorded,
    what: `${action.path}, read to copy it`,
  });
  ctx.log(
    "sysmon-lite",
    { ProcessId: String(process.pid), Image: process.path, TargetFilename: to },
    { eventId: 11, what: `${to} was written to the removable drive` },
  );
}
