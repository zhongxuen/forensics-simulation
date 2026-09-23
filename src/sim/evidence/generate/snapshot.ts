import { encodeBase64 } from "../base64";
import type { DiskImage, FileRecord } from "../types";
import type { DiskState } from "./world";

/**
 * Turning the world's mutable state into the plain, frozen JSON an evidence set is made of. The
 * story is played against `DiskState`, which grows and changes; what gets written to
 * `src/content/evidence/<case>/evidence.json` is a `DiskImage`, which never changes again.
 *
 * Records come out in record-number order and unallocated space in the order it was freed, so the
 * same story always produces the same bytes — which is what `pnpm evidence:check` relies on.
 */
export function freezeDisk(disk: DiskState): DiskImage {
  const records: FileRecord[] = [...disk.records]
    .sort((a, b) => a.record - b.record)
    .map((entry) => ({
      record: entry.record,
      path: entry.path,
      size: entry.kind === "dir" ? 0 : entry.content.length,
      contentB64: entry.kind === "dir" ? "" : encodeBase64(entry.content),
      times: { ...entry.times },
      deleted: entry.deleted,
      clusters: [...entry.clusters],
      owner: entry.owner,
      kind: entry.kind,
    }));

  return {
    id: disk.id,
    device: { ...disk.device },
    sectorSize: 512,
    sectors: disk.sectors,
    partitions: disk.partitions.map((partition) => ({ ...partition })),
    records,
    unallocatedB64: encodeBase64(joinBytes(disk.unallocated)),
    clusterSize: disk.clusterSize,
  };
}

/** One byte array from many, in order. */
export function joinBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
