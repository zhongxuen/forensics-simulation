"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { formatInstant } from "@/sim";
import type { EvidenceSet, LogSource } from "@/sim/types";
import type { WorkspacePaneProps } from "../workspace-panes";

/**
 * The Evidence pane: what was handed over, as the handover form lists it, with each disk's size
 * and hashes, each memory capture, and the log sources. The Evidence Browser (prompt 05.2) takes
 * this tab over, registered in workspace-panes.ts.
 */
export default function EvidencePane({ evidence }: WorkspacePaneProps) {
  if (evidence === undefined) {
    return (
      <p role="status" className="flex items-center gap-3 py-10 text-secondary">
        <Spinner />
        Opening the evidence bag…
      </p>
    );
  }
  if (evidence === null || isEmpty(evidence)) {
    return (
      <EmptyState
        titleAs="h3"
        title="The evidence will be listed here"
        description="This case hasn't had any evidence handed over yet. Your workstation is ready in the terminal while you wait."
      />
    );
  }

  return (
    <div className="space-y-6">
      <p className="leading-7 text-secondary">
        Everything the client handed over. Each item is a read-only copy: you look at it on your
        workstation, and the original stays sealed.
      </p>

      {evidence.disks.length > 0 && (
        <section aria-labelledby="evidence-disks">
          <h3 id="evidence-disks" className="text-sm font-semibold tracking-wide text-secondary">
            Disk images
          </h3>
          <ul className="mt-3 space-y-3">
            {evidence.disks.map((disk) => {
              const form = evidence.handover.find((item) => item.item === disk.id);
              const deleted = disk.records.filter((record) => record.deleted).length;
              return (
                <li key={disk.id} className="rounded-lg border border-subtle bg-surface-base p-4">
                  <p className="font-semibold">
                    <code className="font-mono">{disk.id}</code>
                    <span className="font-normal text-secondary"> · {disk.device.model}</span>
                  </p>
                  <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted">Size</dt>
                    <dd>{formatBytes(disk.sectors * disk.sectorSize)}</dd>
                    <dt className="text-muted">File records</dt>
                    <dd>
                      {disk.records.length}
                      {deleted > 0 && `, ${deleted} marked deleted`}
                    </dd>
                    {form && (
                      <>
                        <dt className="text-muted">Received</dt>
                        <dd>
                          {formatInstant(form.receivedAt)} from {form.by}
                        </dd>
                      </>
                    )}
                    {form?.hashes && (
                      <>
                        <dt className="text-muted">SHA-256 on the form</dt>
                        <dd className="font-mono text-xs break-all">{form.hashes.sha256}</dd>
                      </>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {evidence.memory.length > 0 && (
        <section aria-labelledby="evidence-memory">
          <h3 id="evidence-memory" className="text-sm font-semibold tracking-wide text-secondary">
            Memory captures
          </h3>
          <ul className="mt-3 space-y-2">
            {evidence.memory.map((image) => (
              <li key={image.id} className="text-sm">
                <code className="font-mono">{image.host}</code>, captured{" "}
                {formatInstant(image.capturedAt)}: {image.processes.length} processes
              </li>
            ))}
          </ul>
        </section>
      )}

      {evidence.logs.length > 0 && (
        <section aria-labelledby="evidence-logs">
          <h3 id="evidence-logs" className="text-sm font-semibold tracking-wide text-secondary">
            Logs
          </h3>
          <ul className="mt-3 space-y-2">
            {logCounts(evidence).map(([source, count]) => (
              <li key={source} className="text-sm">
                <code className="font-mono">{source}</code>: {count}{" "}
                {count === 1 ? "record" : "records"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const isEmpty = (evidence: EvidenceSet) =>
  evidence.disks.length === 0 && evidence.memory.length === 0 && evidence.logs.length === 0;

function logCounts(evidence: EvidenceSet): [LogSource, number][] {
  const counts = new Map<LogSource, number>();
  for (const record of evidence.logs)
    counts.set(record.source, (counts.get(record.source) ?? 0) + 1);
  return [...counts];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}
