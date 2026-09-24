"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import type { WorkspacePaneProps } from "@/features/cases";
import { browsableImages, buildTimeline, parseRef } from "@/sim";
import type { BrowsableImage, DiskImage, EvidenceSet } from "@/sim/types";
import { entrySentence, TRACK_LABELS } from "../model/view";
import { TimelineView } from "./timeline-view";

/** A drive whose times are on the timeline: the image as it was read, and where from. */
interface ReadDrive {
  readonly path: string;
  readonly image: DiskImage;
  readonly warning?: readonly string[];
}

/**
 * The Timeline pane (docs/plan/09-timeline.md §The view), registered with one line in
 * `src/features/cases/workspace-panes.ts` and loaded when its tab first opens.
 *
 * Memory captures and logs are data nothing can change, so their moments are on the timeline from
 * the start. A drive's file times come from reading the drive, and the pane never has its own read
 * path: "Add the drive's file times" reads it through `workstation.browse`, the same engine call
 * the disk tools and the Evidence Browser make. It reads a working copy when there is one, and
 * otherwise the original through its write-blocker; with the blocker off, that read changes the
 * original, exactly as `timeline` in the terminal would. If the drive changes after it was read,
 * its moments come off until it is read again.
 */
export function TimelinePane({ evidence, run, dispatch, workstation, reveal }: WorkspacePaneProps) {
  const [reads, setReads] = useState<Readonly<Record<string, ReadDrive>>>({});
  const sim = workstation.sim;

  const drives = useMemo(() => {
    const images = browsableImages(sim);
    return (evidence?.disks ?? []).map((disk) => {
      const candidates = images.filter((image) => image.id === disk.id);
      const target = candidates.find((image) => !image.device) ?? candidates[0];
      const read = reads[disk.id];
      const current = read && images.find((image) => image.path === read.path);
      const fresh = read && current?.image === read.image ? read : undefined;
      return { id: disk.id, target, read, fresh };
    });
  }, [sim, evidence, reads]);

  const set = useMemo<EvidenceSet | null>(
    () =>
      evidence && {
        ...evidence,
        disks: drives.flatMap((drive) => (drive.fresh ? [drive.fresh.image] : [])),
      },
    [evidence, drives],
  );
  const entries = useMemo(() => (set ? buildTimeline(set) : []), [set]);

  if (!evidence || !set || (evidence.disks.length === 0 && entries.length === 0)) {
    return (
      <EmptyState
        titleAs="h3"
        title="The timeline will fill in here"
        description="This case has no evidence with times in it yet. Once a drive, a memory capture or logs are handed over, every moment in them lines up here."
      />
    );
  }

  const addDrive = (id: string, target: BrowsableImage) => {
    const opened = workstation.browse(target.path);
    if (!opened) return;
    setReads((previous) => ({
      ...previous,
      [id]: {
        path: target.path,
        image: opened.view.image,
        ...(opened.warning && { warning: opened.warning }),
      },
    }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Timeline</h3>
        <p className="mt-1 leading-7 text-secondary">
          Every moment in the evidence, from every source, in the order it happened. Each row is one
          source. Choose a moment and everything close to it in time lights up on every row:
          that&apos;s how one clue turns into a story.
        </p>
      </div>

      {drives.map((drive) =>
        drive.fresh ? (
          drive.fresh.warning && (
            <Callout key={drive.id} kind="warning" title="Read around the write-blocker">
              {drive.fresh.warning.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </Callout>
          )
        ) : (
          <DriveCard
            key={drive.id}
            id={drive.id}
            target={drive.target}
            stale={drive.read !== undefined}
            onAdd={() => drive.target && addDrive(drive.id, drive.target)}
          />
        ),
      )}

      {entries.length > 0 && (
        <TimelineView
          set={set}
          entries={entries}
          pins={run.pins}
          onPin={(ref) => dispatch({ type: "pin", ref })}
          onUnpin={(ref) => dispatch({ type: "unpin", ref })}
          showInTerminal={workstation.showInTerminal}
          showInEvidence={(ref) => workstation.show("evidence", ref)}
          {...(workstation.explain && {
            // The entry's own sentence — the same words a screen reader hears — and nothing else:
            // the mentor never receives the evidence set (docs/plan/14-mentor.md §Spec).
            explainEntry: (entry) =>
              workstation.explain?.({
                text: entrySentence(set, entry, false),
                title: `${TRACK_LABELS[entry.source]} on ${entry.host}`,
                fallback: `${entrySentence(set, entry, false)} That is one moment on the timeline: where it came from, when it happened, what kind of moment it was, and what it says.`,
              }),
          })}
          {...(reveal && { reveal })}
          missing={(ref) => {
            const parsed = parseRef(ref);
            return parsed?.kind === "file"
              ? `${parsed.image}'s file times aren't on the timeline yet. Add them first, then show it again.`
              : `${ref} has no moment on the timeline.`;
          }}
        />
      )}
    </div>
  );
}

function DriveCard({
  id,
  target,
  stale,
  onAdd,
}: {
  id: string;
  target: BrowsableImage | undefined;
  stale: boolean;
  onAdd: () => void;
}) {
  const how = !target
    ? `The drive ${id} isn't attached to your workstation, so there's nothing to read.`
    : !target.device
      ? `This reads your working copy at ${target.path}, so the original stays as it arrived.`
      : target.device.blocker
        ? `This reads the original at ${target.path} through its write-blocker, which is on, so nothing on it changes.`
        : `The write-blocker on ${target.path} is off. Reading the original now changes its access times, the way any tool would. Type blocker on ${target.path} in the terminal first to keep it as it arrived.`;
  return (
    <div className="space-y-2 rounded-lg border border-subtle bg-surface-raised px-4 py-3">
      <p className="font-semibold">
        {stale
          ? `${id} has changed since its times were added`
          : `${id}'s file times aren't on the timeline yet`}
      </p>
      <p className="text-sm leading-6 text-secondary">
        {stale
          ? "A read with the write-blocker off, or Reset machine, changed the drive. Add its times again to see it as it is now. "
          : "A drive's times come from reading it, like any tool does. "}
        {how}
      </p>
      {target && (
        <Button size="sm" variant="secondary" onClick={onAdd}>
          {stale ? `Add ${id}'s times again` : `Add ${id}'s file times`}
        </Button>
      )}
    </div>
  );
}
