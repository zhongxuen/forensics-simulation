import type { ActionOf } from "../types";
import { createRecord, makeSerial, type ActionContext, type DiskState } from "../world";

/**
 * A removable drive is plugged in. It becomes its own disk image, with its own device name and
 * serial for the evidence bag, because that is what it is: a separate device an examiner images
 * separately. A case that wants it in evidence lists its id under `evidence.disks`.
 *
 * Leaves: the drive, with its root folder, and the letter it appears as on the machine.
 */
export function applyUsbInsert(ctx: ActionContext, action: ActionOf<"usb-insert">): void {
  const letter = (action.letter ?? "E").toUpperCase();
  if (!/^[D-Z]$/.test(letter)) {
    ctx.fail(`"${letter}" is not a drive letter a removable drive would get. Use D to Z.`);
  }
  if (ctx.machine.volumes.has(letter)) {
    ctx.fail(
      `drive ${letter}: is already in use on ${ctx.machine.id}. Give this one another letter.`,
    );
  }
  if (ctx.world.disks.has(action.device)) {
    ctx.fail(`there is already a disk image called "${action.device}" in this case.`);
  }

  const disk: DiskState = {
    id: action.device,
    device: {
      model: action.model ?? "Wrenfold 32 GB memory stick",
      serial: action.serial ?? makeSerial(ctx.rng, "WF"),
    },
    sectors: 62_914_560,
    clusterSize: 4096,
    partitions: [
      { index: 0, label: "Removable", fs: "NTFS-like", startSector: 2048, sectors: 62_912_512 },
    ],
    records: [],
    unallocated: [],
    unallocatedLength: 0,
    nextRecord: 5,
    nextCluster: 1000,
    removable: true,
  };
  const root = createRecord(disk, `${letter}:\\`, {
    at: ctx.recorded,
    owner: "SYSTEM",
    kind: "dir",
  });

  ctx.world.disks.set(disk.id, disk);
  ctx.machine.volumes.set(letter, disk);
  ctx.note({
    kind: "file",
    image: disk.id,
    record: root.record,
    at: ctx.recorded,
    what: `${action.device}, plugged in as ${letter}:`,
  });
}
