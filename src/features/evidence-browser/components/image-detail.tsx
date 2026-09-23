import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import type { EvidenceSet } from "@/sim/types";
import type { ImageNode, PartitionNode } from "../model/tree";

/** "1.0 MB", "512 bytes": a drive's size from its sector count. */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} bytes`;
}

interface ImageDetailProps {
  node: ImageNode;
  evidence: EvidenceSet;
  onOpen: () => void;
}

/**
 * A drive, before and after it's opened: what it is, its write-blocker (for an original), the
 * hashes on the handover form, and the one button that reads it. Opening an original with its
 * blocker off changes it, and this says so before and after, in the tools' own words.
 */
export function ImageDetail({ node, evidence, onOpen }: ImageDetailProps) {
  const { image } = node;
  const device = image.device;
  const form = evidence.handover.find((item) => item.item === image.id);
  const sized = image.image.sectors * image.image.sectorSize;
  const shortCopy = `~/cases/images/${image.id}.img`;

  return (
    <section className="space-y-3" aria-label={`Drive ${image.id}`}>
      <div>
        <h4 className="font-mono text-base font-semibold break-all">{image.id}</h4>
        <p className="text-sm text-secondary">
          {device
            ? "The original drive, as it was handed over, attached through a write-blocker."
            : "Your working copy, made with acquire. Reading a copy never touches the original."}
        </p>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">On your workstation</dt>
        <dd className="font-mono text-xs break-all">{image.path}</dd>
        <dt className="text-muted">Device</dt>
        <dd>
          {image.image.device.model}, serial{" "}
          <span className="font-mono">{image.image.device.serial}</span>
        </dd>
        <dt className="text-muted">Size</dt>
        <dd>
          {formatBytes(sized)} ({image.image.sectors.toLocaleString("en-GB")} sectors of{" "}
          {image.image.sectorSize} bytes)
        </dd>
        <dt className="text-muted">Partitions</dt>
        <dd>{image.image.partitions.length}</dd>
        {device && (
          <>
            <dt className="text-muted">Write-blocker</dt>
            <dd>{device.blocker ? "on: reads change nothing" : "off: reads change the drive"}</dd>
          </>
        )}
        {form?.hashes && (
          <>
            <dt className="text-muted">SHA-256 on the handover form</dt>
            <dd className="font-mono text-xs break-all">{form.hashes.sha256}</dd>
          </>
        )}
      </dl>

      {device && !device.blocker && (!node.opened || node.stale) && (
        <Callout kind="warning" title="The write-blocker is off">
          <p>
            Opening the original now gives every live file on it a new access time, and its hash
            will no longer match the handover form. Turn the blocker back on in the terminal with{" "}
            <code className="font-mono">blocker on {image.path}</code> first.
          </p>
        </Callout>
      )}
      {device && device.blocker && !node.opened && (
        <Callout kind="tip">
          <p>
            With the write-blocker on, opening the original changes nothing. Examiners still work on
            a copy: make one in the terminal with{" "}
            <code className="font-mono">
              acquire {image.path} --out {shortCopy}
            </code>
            .
          </p>
        </Callout>
      )}
      {node.opened?.warning && !node.stale && (
        <Callout kind="warning" title="The original has changed">
          {node.opened.warning
            .filter((line) => line.trim() !== "")
            .map((line, i) => (
              <p key={i}>{line}</p>
            ))}
        </Callout>
      )}

      {!node.opened || node.stale ? (
        <div className="space-y-2">
          {node.stale && (
            <p className="text-secondary">
              This drive has changed since you opened it: something read the original with its
              write-blocker off, or the machine was reset. Open it again to see it as it is now.
            </p>
          )}
          <Button variant="primary" onClick={onOpen}>
            {node.stale ? "Open it again" : `Open ${image.id}`}
          </Button>
        </div>
      ) : (
        <p className="text-secondary">
          Open. Pick a folder in the tree to list what&apos;s in it, or turn on Deleted only to see
          every deleted record on the drive. {node.opened.view.records.length} records in all,{" "}
          {node.opened.view.records.filter((record) => record.deleted).length} of them deleted.
        </p>
      )}
    </section>
  );
}

/** A partition: where it sits, and whether the simulation keeps any files on it. */
export function PartitionDetail({ node }: { node: PartitionNode }) {
  const { partition } = node;
  return (
    <section className="space-y-3" aria-label={`Partition ${partition.label}`}>
      <h4 className="text-base font-semibold">
        {partition.label}{" "}
        <span className="text-sm font-normal text-secondary">
          (partition {partition.index + 1}, {partition.fs})
        </span>
      </h4>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Starts at sector</dt>
        <dd className="font-mono">{partition.startSector.toLocaleString("en-GB")}</dd>
        <dt className="text-muted">Sectors</dt>
        <dd className="font-mono">{partition.sectors.toLocaleString("en-GB")}</dd>
        <dt className="text-muted">Size</dt>
        <dd>{formatBytes(partition.sectors * 512)}</dd>
      </dl>
      <p className="text-secondary">
        {node.holdsFiles
          ? "This partition holds the file system: its folders are under it in the tree."
          : "A small partition that holds the files a computer needs to start. This simulation leaves it empty, so there's nothing to look at here."}
      </p>
    </section>
  );
}
