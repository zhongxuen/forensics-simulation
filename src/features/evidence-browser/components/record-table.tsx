"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { parentPath } from "@/sim";
import type { FileRecord } from "@/sim/types";
import {
  formatSize,
  MACB_KEYS,
  MACB_NAMES,
  recordName,
  showTime,
  type ColumnKey,
  type SortOrder,
} from "../model/table";

interface RecordTableProps {
  /** What the table lists, for its caption: "Files in C:\Users\yard". */
  caption: string;
  rows: readonly FileRecord[];
  /** The selected row's record number, if one is. */
  selected: number | undefined;
  onSelect: (record: FileRecord) => void;
  /** Enter on a row: into a folder, or over to the record's details. */
  onOpen: (record: FileRecord) => void;
  onTogglePin: (record: FileRecord) => void;
  isPinned: (record: FileRecord) => boolean;
  sort: SortOrder;
  onSort: (column: ColumnKey) => void;
  /** The zone the times are shown in. */
  zone: string;
  /** Show each record's folder under its name: the table is listing the whole drive. */
  showFolder: boolean;
  /** Said in the table's place when there are no rows. */
  empty: ReactNode;
}

const COLUMNS: readonly { key: ColumnKey; label: string; title?: string }[] = [
  { key: "name", label: "Name" },
  { key: "record", label: "Record" },
  { key: "size", label: "Size" },
  { key: "owner", label: "Owner" },
  ...MACB_KEYS.map((key) => ({ key, label: key.toUpperCase(), title: MACB_NAMES[key] })),
];

/**
 * The table of file records: name, record number, size, owner and the four MACB times. Every
 * column sorts from its header button. The rows are one tab stop: Up and Down move between them
 * (the details follow), Home and End jump to the ends, Enter opens a folder or moves to the
 * record's details, and `p` pins the row's record to the case board or takes it off again.
 *
 * The table is also the accessible form of the tree: everything the tree shows, a folder at a
 * time, with real table semantics.
 */
export function RecordTable({
  caption,
  rows,
  selected,
  onSelect,
  onOpen,
  onTogglePin,
  isPinned,
  sort,
  onSort,
  zone,
  showFolder,
  empty,
}: RecordTableProps) {
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const activeIndex = Math.max(
    0,
    rows.findIndex((row) => row.record === selected),
  );

  const focusRow = (index: number) => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!row) return;
    onSelect(row);
    rowRefs.current.get(row.record)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, record: FileRecord) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    // On the row's own buttons, Enter and Space press the button.
    const onRow = event.target === event.currentTarget;
    const index = rows.indexOf(record);
    let handled = true;
    switch (event.key) {
      case "ArrowDown":
        focusRow(index + 1);
        break;
      case "ArrowUp":
        focusRow(index - 1);
        break;
      case "Home":
        focusRow(0);
        break;
      case "End":
        focusRow(rows.length - 1);
        break;
      case "Enter":
        if (onRow) onOpen(record);
        else handled = false;
        break;
      case "p":
      case "P":
        onTogglePin(record);
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  };

  if (rows.length === 0) return <div className="text-secondary">{empty}</div>;

  return (
    <div className="overflow-x-auto rounded-md border border-subtle">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">
          {caption}. Up and Down move between rows, Enter opens one, and P pins it to the case
          board.
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
                    onClick={() => onSort(column.key)}
                    className="rounded px-1.5 py-1 hover:bg-surface-overlay hover:text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
                  >
                    {column.title ? (
                      <>
                        <abbr title={column.title} className="no-underline">
                          {column.label}
                        </abbr>{" "}
                        <span className="sr-only">({column.title})</span>
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
          {rows.map((record, index) => {
            const active = index === activeIndex;
            const isSelected = record.record === selected;
            const pinned = isPinned(record);
            const name = recordName(record);
            return (
              <tr
                key={record.record}
                ref={(element) => {
                  if (element) rowRefs.current.set(record.record, element);
                  else rowRefs.current.delete(record.record);
                }}
                tabIndex={active ? 0 : -1}
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onSelect(record)}
                onDoubleClick={() => onOpen(record)}
                onKeyDown={(event) => onKeyDown(event, record)}
                className={cx(
                  "cursor-default border-t border-subtle align-top",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
                  isSelected ? "bg-surface-overlay" : "hover:bg-surface-raised",
                )}
              >
                <td className="max-w-56 px-2.5 py-1.5">
                  <span className="flex flex-wrap items-baseline gap-x-1.5 font-mono">
                    <span className="sr-only">{record.kind === "dir" ? "Folder: " : "File: "}</span>
                    <span aria-hidden="true" className="text-muted">
                      {record.kind === "dir" ? "▤" : "▫"}
                    </span>
                    <span className={cx("break-all", record.deleted && "line-through")}>
                      {name}
                    </span>
                    {record.deleted && (
                      <span className="font-sans text-xs font-medium text-status-danger">
                        deleted
                      </span>
                    )}
                    {pinned && (
                      <span className="font-sans text-xs font-medium text-accent">pinned</span>
                    )}
                  </span>
                  {showFolder && (
                    <span className="block font-mono text-xs break-all text-muted">
                      {parentPath(record.path) ?? ""}
                    </span>
                  )}
                </td>
                <td className="px-2.5 py-1.5 font-mono tabular-nums">{record.record}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap tabular-nums">
                  {formatSize(record)}
                </td>
                <td className="px-2.5 py-1.5">{record.owner}</td>
                {MACB_KEYS.map((key) => (
                  <td key={key} className="px-2.5 py-1.5 font-mono text-xs whitespace-nowrap">
                    {showTime(record.times[key], zone)}
                  </td>
                ))}
                <td className="px-2 py-1">
                  <button
                    type="button"
                    tabIndex={active ? 0 : -1}
                    onClick={(event) => {
                      event.stopPropagation();
                      onTogglePin(record);
                    }}
                    className="rounded-md border border-subtle px-2 py-0.5 text-xs font-medium whitespace-nowrap text-secondary hover:border-accent hover:text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
                  >
                    {pinned ? "Unpin" : "Pin"} <span className="sr-only">{name}</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
