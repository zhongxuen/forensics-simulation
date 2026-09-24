"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { EvidenceBrowser } from "@/features/evidence-browser";
import { formatInstant } from "@/sim";
import type { EvidenceSet, LogSource } from "@/sim/types";
import type { WorkspacePaneProps } from "../workspace-panes";

/**
 * The Evidence pane: the Evidence Browser over the case's drives (src/features/evidence-browser),
 * then what else was handed over, memory captures and log sources, which the Timeline tab (file
 * 09) and the memory tools (file 08) open up. This module is the pane's chunk, so the browser only
 * downloads when the Evidence tab first opens.
 *
 * The browser reads nothing itself: it gets the workstation's engine state and opens drives
 * through `workstation.browse`, the same engine call the disk tools make. Pins go on the run's
 * board, the same one the terminal's `pin` fills.
 */
export default function EvidencePane({
  evidence,
  run,
  dispatch,
  workstation,
  reveal,
}: WorkspacePaneProps) {
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
      <div>
        <h3 className="text-lg font-semibold">Evidence Browser</h3>
        <p className="mt-1 leading-7 text-secondary">
          Everything the client handed over. Open a drive to look through its folders, the files in
          them, and the files that were deleted. You read it on your workstation through the same
          write-blockers as the terminal, so the original stays as it was.
        </p>
      </div>

      <EvidenceBrowser
        sim={workstation.sim}
        evidence={evidence}
        browse={workstation.browse}
        pins={run.pins}
        onPin={(ref) => dispatch({ type: "pin", ref })}
        onUnpin={(ref) => dispatch({ type: "unpin", ref })}
        showInTerminal={workstation.showInTerminal}
        {...(workstation.explain && { explainRow: workstation.explain })}
        {...(reveal && { reveal })}
      />

      {(evidence.memory.length > 0 || evidence.logs.length > 0) && (
        <section aria-labelledby="evidence-also" className="space-y-3">
          <h3 id="evidence-also" className="text-sm font-semibold tracking-wide text-secondary">
            Also handed over
          </h3>
          <ul className="space-y-2 text-sm">
            {evidence.memory.map((image) => (
              <li key={image.id}>
                A memory capture of <code className="font-mono">{image.host}</code>, taken{" "}
                {formatInstant(image.capturedAt)}: {image.processes.length} processes
              </li>
            ))}
            {logCounts(evidence).map(([source, count]) => (
              <li key={source}>
                Logs from <code className="font-mono">{source}</code>: {count}{" "}
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
