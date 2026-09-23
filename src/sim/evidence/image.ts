import { decodeBase64 } from "./base64";
import { ByteWriter } from "./bytes";
import { hashHex, type HashAlgorithm } from "./hash";
import type { DiskImage, FileRecord } from "./types";

/**
 * One deterministic byte layout for a disk image (docs/plan/02-evidence-model.md §Disk image).
 *
 * **Hashes are always of these bytes.** Nothing else is ever hashed — not the JSON, not an object —
 * so the game, the generator and the tests always agree on what a disk's hash is. Change this
 * layout and every stored hash changes with it, which is why the format carries a version.
 *
 * It is a container, not a sector-by-sector dump: the simulated disks are sparse (a few real files
 * in a nominally 1 GB drive), and a dump would be gigabytes of zeros. What it does keep is
 * everything a change to the evidence could touch, in a fixed order:
 *
 * ```text
 * header        magic "CWIMAGE1", sector size, sectors, cluster size, id, device model, serial
 * partitions    count, then each partition in index order
 * records       count, then each record in record-number order: number, path, owner, kind,
 *               deleted, size, the four MACB times, its clusters, and its content zero-filled to
 *               the end of its last cluster (the slack space a real file leaves behind)
 * unallocated   length, then the bytes deleted files and carved objects live in
 * ```
 *
 * Numbers are little-endian; text is UTF-8 with its byte length in front; times are IEEE 754
 * doubles, exact for every millisecond an `Instant` can hold. Because the MACB times are in there,
 * `mountWrite` (which sets access times) changes the hash — that is Case 1's wrong turn, and
 * tests/unit/evidence-image.test.ts proves it.
 */
export const IMAGE_FORMAT_MAGIC = "CWIMAGE1";

export function imageBytes(disk: DiskImage): Uint8Array {
  const out = new ByteWriter(4096);

  for (const char of IMAGE_FORMAT_MAGIC) out.u8(char.charCodeAt(0));
  out.u32(disk.sectorSize);
  out.u32(disk.sectors);
  out.u32(disk.clusterSize);
  out.text(disk.id);
  out.text(disk.device.model);
  out.text(disk.device.serial);

  const partitions = [...disk.partitions].sort((x, y) => x.index - y.index);
  out.u32(partitions.length);
  for (const partition of partitions) {
    out.u32(partition.index);
    out.text(partition.label);
    out.text(partition.fs);
    out.u32(partition.startSector);
    out.u32(partition.sectors);
  }

  const records = [...disk.records].sort((x, y) => x.record - y.record);
  out.u32(records.length);
  for (const record of records) writeRecord(out, record, disk.clusterSize);

  const unallocated = decodeBase64(disk.unallocatedB64);
  out.u32(unallocated.length);
  out.bytes(unallocated);

  return out.done();
}

/** The hash a tool or an evidence form would print for a whole disk image. */
export function imageHash(algorithm: HashAlgorithm, disk: DiskImage): string {
  return hashHex(algorithm, imageBytes(disk));
}

function writeRecord(out: ByteWriter, record: FileRecord, clusterSize: number): void {
  out.u32(record.record);
  out.text(record.path);
  out.text(record.owner);
  out.u8(record.kind === "dir" ? 0 : 1);
  out.u8(record.deleted ? 1 : 0);
  out.u32(record.size);
  out.f64(record.times.m);
  out.f64(record.times.a);
  out.f64(record.times.c);
  out.f64(record.times.b);

  out.u32(record.clusters.length);
  for (const cluster of record.clusters) out.u32(cluster);

  const content = decodeBase64(record.contentB64);
  out.u32(content.length);
  out.bytes(content);
  // Slack: the rest of the last cluster the file was given. A directory has no clusters and so no
  // slack, and a file whose content outgrew its clusters just takes the room it needs.
  out.zeros(Math.max(0, record.clusters.length * clusterSize - content.length));
}
