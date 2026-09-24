"use client";

import { useId, useMemo, useState } from "react";
import { cx } from "@/lib/cx";
import { UTC_ZONE } from "@/sim";
import type { EvidenceBrowserProps } from "../browser-tabs";
import { showTime } from "../model/table";
import {
  DEFAULT_PROCESS_SORT,
  listedLabel,
  nextSort,
  processRows,
  sortProcesses,
  type ProcessColumn,
  type ProcessRow,
  type ProcessSort,
} from "./processes";

const COLUMNS: readonly { key: ProcessColumn; label: string; title?: string }[] = [
  { key: "pid", label: "PID", title: "Process ID: the number Windows gave the process" },
  { key: "ppid", label: "PPID", title: "Parent process ID: the process that started this one" },
  { key: "name", label: "Name" },
  { key: "created", label: "Started" },
  { key: "exited", label: "Exited" },
  { key: "user", label: "User" },
  { key: "listed", label: "In active list?" },
];

/**
 * The Evidence Browser's Processes tab (docs/plan/08-memory-tools.md), modelled on the process
 * views of memory tools: every process a scan of the memory image finds, the same list `mem psscan`
 * prints, with a column saying whether the active list (`mem ps`) has it. A process missing from
 * that list while still running is the one that was hiding. Every column sorts from its header, and
 * each row pins its process to the case board.
 */
export function ProcessesView({
  evidence,
  pins,
  onPin,
  onUnpin,
  showInTerminal,
}: EvidenceBrowserProps) {
  const images = evidence.memory;
  const [imageId, setImageId] = useState(images[0]?.id);
  const [sort, setSort] = useState<ProcessSort>(DEFAULT_PROCESS_SORT);
  const [localTimes, setLocalTimes] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const baseId = useId();

  const image = images.find((candidate) => candidate.id === imageId) ?? images[0];
  const rows = useMemo(() => (image ? sortProcesses(processRows(image), sort) : []), [image, sort]);

  if (!image) {
    return (
      <p className="text-secondary">
        This case has no memory images, so there are no processes to list. Its evidence is the disk
        and the logs.
      </p>
    );
  }

  const hostZone = evidence.zones.disk;
  const zone = localTimes && hostZone ? hostZone : UTC_ZONE;

  const announce = (text: string) =>
    setAnnouncement((previous) => (previous === text ? `${text} ` : text));
  const togglePin = (row: ProcessRow) => {
    const label = `${row.name} (pid ${row.pid})`;
    if (pins.includes(row.ref)) {
      onUnpin(row.ref);
      announce(`Took ${label} off the case board.`);
    } else {
      onPin(row.ref);
      announce(`Pinned ${label} to the case board.`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
        {images.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-secondary">Memory image</span>
            <select
              value={image.id}
              onChange={(event) => setImageId(event.target.value)}
              className="rounded-md border border-strong bg-surface-base px-2 py-1 font-mono"
            >
              {images.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.id}
                </option>
              ))}
            </select>
          </label>
        )}
        {hostZone && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={localTimes}
              onChange={(event) => setLocalTimes(event.target.checked)}
              className="size-4 accent-accent"
            />
            Show times on the computer&apos;s own clock ({hostZone})
          </label>
        )}
        <button
          type="button"
          onClick={() => showInTerminal(`mem psscan ${image.id}`)}
          className="rounded-md border border-subtle px-2.5 py-1 text-xs font-medium text-secondary hover:border-accent hover:text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          Show in terminal
        </button>
      </div>

      <p id={`${baseId}-about`} className="max-w-prose text-sm text-secondary">
        Every process a scan of <code className="font-mono">{image.id}</code> found, captured{" "}
        <span className="font-mono">{showTime(image.capturedAt, zone)}</span>: the same list as{" "}
        <code className="font-mono">mem psscan</code>. &ldquo;In active list?&rdquo; says whether
        the list Windows keeps of what is running (<code className="font-mono">mem ps</code>) has
        it. A process still running but missing from that list was taken out of it on purpose.
      </p>

      <div className="overflow-x-auto rounded-md border border-subtle">
        <table
          className="w-full border-collapse text-left text-sm"
          aria-describedby={`${baseId}-about`}
        >
          <caption className="sr-only">
            Processes in {image.id}, {rows.length} of them. Sort by a column with its header button;
            pin a process with its Pin button.
          </caption>
          <thead className="bg-surface-raised text-xs text-secondary">
            <tr>
              {COLUMNS.map((column) => {
                const active = sort.column === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? sort.direction : undefined}
                    className="px-1 py-1 font-semibold whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={() => setSort(nextSort(sort, column.key))}
                      className="rounded px-1.5 py-1 hover:bg-surface-overlay hover:text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
                    >
                      {column.title ? (
                        <>
                          <abbr title={column.title} className="no-underline">
                            {column.label}
                          </abbr>
                          <span className="sr-only"> ({column.title})</span>
                        </>
                      ) : (
                        column.label
                      )}
                      <span aria-hidden="true" className="ml-1 inline-block w-2">
                        {active ? (sort.direction === "ascending" ? "↑" : "↓") : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="px-2 py-1 font-semibold">
                <span className="sr-only">Case board</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pinned = pins.includes(row.ref);
              const hiddenRow = row.status === "unlinked";
              return (
                <tr key={row.pid} className="border-t border-subtle align-top">
                  <td className="px-2.5 py-1.5 font-mono tabular-nums">{row.pid}</td>
                  <td className="px-2.5 py-1.5 font-mono tabular-nums">{row.ppid}</td>
                  <td className="max-w-64 px-2.5 py-1.5">
                    <span className="block font-mono break-all">{row.name}</span>
                    <span className="block font-mono text-xs break-all text-muted">{row.path}</span>
                    {pinned && <span className="text-xs font-medium text-accent">pinned</span>}
                  </td>
                  <td className="px-2.5 py-1.5 font-mono text-xs whitespace-nowrap">
                    {showTime(row.createdAt, zone)}
                  </td>
                  <td className="px-2.5 py-1.5 font-mono text-xs whitespace-nowrap">
                    {row.exitedAt === undefined ? (
                      <>
                        <span aria-hidden="true">-</span>
                        <span className="sr-only">still running</span>
                      </>
                    ) : (
                      showTime(row.exitedAt, zone)
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 break-all">{row.user}</td>
                  <td
                    className={cx(
                      "px-2.5 py-1.5",
                      hiddenRow && "font-medium text-status-danger",
                      row.status === "exited" && "text-muted",
                    )}
                  >
                    {listedLabel(row.status)}
                  </td>
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      onClick={() => togglePin(row)}
                      className="rounded-md border border-subtle px-2 py-0.5 text-xs font-medium whitespace-nowrap text-secondary hover:border-accent hover:text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
                    >
                      {pinned ? "Unpin" : "Pin"}{" "}
                      <span className="sr-only">
                        {row.name}, pid {row.pid}
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
