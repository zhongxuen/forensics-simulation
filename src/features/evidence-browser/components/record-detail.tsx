"use client";

import { Fragment, useId, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { clusterRanges, clusterReuse, UTC_ZONE } from "@/sim";
import type { DiskView, FileRecord } from "@/sim/types";
import { textContent } from "../model/bytes";
import { formatSize, MACB_KEYS, MACB_NAMES, recordName, showTime } from "../model/table";
import { HexView } from "./hex-view";

interface RecordDetailProps {
  view: DiskView;
  record: FileRecord;
  /** The ref the board keeps: `disk:<image>:mft/<record>`. */
  artefactRef: string;
  pinned: boolean;
  onTogglePin: () => void;
  /** The command that shows this record in the terminal. */
  terminalCommand: string;
  onShowInTerminal: () => void;
  zone: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

/** What each MACB time means, the same notes `inode` prints. */
const TIME_NOTES: Readonly<Record<keyof FileRecord["times"], string>> = {
  m: "the content changed",
  a: "something opened it",
  c: "the record changed: a rename, a permission edit",
  b: "it was created",
};

/**
 * One record, the way Autopsy's content viewer shows it: its text, its bytes, everything its
 * record says about it, and which real tool this view copies. Everything here comes from the read
 * view the engine handed back, so it's exactly what the terminal's tools would show.
 */
export function RecordDetail({
  view,
  record,
  artefactRef,
  pinned,
  onTogglePin,
  terminalCommand,
  onShowInTerminal,
  zone,
  headingRef,
}: RecordDetailProps) {
  const name = recordName(record);
  const bytes = view.content(record);
  const folder = record.kind === "dir";
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="font-mono text-base font-semibold break-all outline-none"
          >
            <span className={record.deleted ? "line-through" : undefined}>{name}</span>
            {record.deleted && (
              <span className="ml-2 font-sans text-sm font-medium text-status-danger">deleted</span>
            )}
          </h4>
          <p className="font-mono text-xs break-all text-muted">{record.path}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={pinned ? "secondary" : "primary"} onClick={onTogglePin}>
            {pinned ? "Unpin from the case board" : "Pin to the case board"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onShowInTerminal}>
            Show in terminal
          </Button>
        </div>
      </div>
      <p className="text-sm text-secondary">
        Show in terminal puts <code className="font-mono text-primary">{terminalCommand}</code> at
        the prompt for you to run.
      </p>

      <Tabs
        label={`Views of ${name}`}
        tabs={[
          {
            id: "text",
            label: "Text",
            content: folder ? <FolderNote /> : <TextTab bytes={bytes} name={name} />,
          },
          {
            id: "hex",
            label: "Hex",
            content: folder ? <FolderNote /> : <HexView bytes={bytes} name={name} />,
          },
          {
            id: "metadata",
            label: "Metadata",
            content: (
              <MetadataTab view={view} record={record} artefactRef={artefactRef} zone={zone} />
            ),
          },
          { id: "real-world", label: "Real-world equivalent", content: <RealWorldTab /> },
        ]}
      />
    </section>
  );
}

function FolderNote() {
  return (
    <p className="text-secondary">
      A folder has no content of its own. What&apos;s in it is listed in the table.
    </p>
  );
}

function TextTab({ bytes, name }: { bytes: Uint8Array; name: string }) {
  const content = textContent(bytes);
  if (content.kind === "empty") {
    return <p className="text-secondary">This file is empty: its record says 0 bytes.</p>;
  }
  if (content.kind === "text") {
    return (
      <pre
        tabIndex={0}
        aria-label={`Text of ${name}`}
        className="max-h-64 overflow-auto rounded-md border border-subtle bg-term-bg p-3 font-mono text-xs leading-6 whitespace-pre-wrap text-term-fg focus-visible:outline-2 focus-visible:outline-focus-ring"
      >
        {content.text}
      </pre>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-secondary">
        This file isn&apos;t text, so here are the runs of four or more readable characters found in
        it, the way a strings view shows them. The Hex tab shows every byte.
      </p>
      {content.strings.length === 0 ? (
        <p className="text-secondary">There are none: nothing in it reads as text.</p>
      ) : (
        <ul className="rounded-md border border-subtle bg-term-bg p-3 font-mono text-xs leading-6 text-term-fg">
          {content.strings.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetadataTab({
  view,
  record,
  artefactRef,
  zone,
}: {
  view: DiskView;
  record: FileRecord;
  artefactRef: string;
  zone: string;
}) {
  const reuse = record.deleted && record.kind === "file" ? clusterReuse(view, record) : undefined;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      <dt className="text-muted">Record</dt>
      <dd className="font-mono">{record.record}</dd>
      <dt className="text-muted">Path</dt>
      <dd className="font-mono break-all">{record.path}</dd>
      <dt className="text-muted">Kind</dt>
      <dd>{record.kind === "dir" ? "folder" : "file"}</dd>
      <dt className="text-muted">Owner</dt>
      <dd>{record.owner}</dd>
      <dt className="text-muted">Size</dt>
      <dd>{formatSize(record)}</dd>
      <dt className="text-muted">Deleted</dt>
      <dd>{record.deleted ? "yes" : "no"}</dd>
      <dt className="text-muted">Clusters</dt>
      <dd className="font-mono">
        {clusterRanges(record.clusters)}
        {record.clusters.length > 0 && (
          <span className="font-sans text-secondary">
            {" "}
            ({record.clusters.length} of {view.image.clusterSize.toLocaleString("en-GB")} bytes)
          </span>
        )}
      </dd>
      {reuse && (
        <>
          <dt className="text-muted">Recoverable</dt>
          <dd>
            {reuse.clusters.length === 0
              ? "Yes: nothing has been written over its clusters yet, so the content is still on the drive."
              : `No: ${clusterRanges(reuse.clusters)} ${reuse.clusters.length === 1 ? "holds" : "hold"} something else now${reuse.by ? ` (${reuse.by.path}, record ${reuse.by.record})` : ""}. The record, with its name, size and times, is still evidence.`}
          </dd>
        </>
      )}
      {MACB_KEYS.map((key) => (
        <Fragment key={key}>
          <dt className="text-muted">
            {key.toUpperCase()} {MACB_NAMES[key].toLowerCase()}
          </dt>
          <dd>
            <span className="font-mono text-xs">{showTime(record.times[key], zone)}</span>
            <span className="text-secondary">: {TIME_NOTES[key]}</span>
          </dd>
        </Fragment>
      ))}
      <dt className="text-muted">Times shown in</dt>
      <dd>{zone === UTC_ZONE ? "UTC" : `${zone}, the drive's own clock`}</dd>
      <dt className="text-muted">Ref</dt>
      <dd className="font-mono break-all">{artefactRef}</dd>
    </dl>
  );
}

function RealWorldTab() {
  return (
    <div className="space-y-2 leading-7 text-secondary">
      <p>
        This browser copies <strong className="text-primary">Autopsy</strong>, the free forensic
        suite built on The Sleuth Kit. Its Data Sources tree lists images, volumes and folders; the
        table beside it lists files with their MACB times; and the content viewer underneath has
        Text, Hex and File Metadata tabs, like these.
      </p>
      <p>
        Pinning is Autopsy&apos;s <em>Tag File</em>. Filtering to deleted records is its{" "}
        <em>Deleted Files</em> view. FTK Imager&apos;s Evidence Tree and file list do the same job,
        and in a terminal, The Sleuth Kit&apos;s <code className="font-mono">fls</code> and{" "}
        <code className="font-mono">istat</code> print the same records, as this game&apos;s{" "}
        <code className="font-mono">lsfs</code> and <code className="font-mono">inode</code> do.
      </p>
    </div>
  );
}
