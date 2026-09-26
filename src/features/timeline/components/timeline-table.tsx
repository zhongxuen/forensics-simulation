"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { cx } from "@/lib/cx";
import type { EvidenceSet, TimelineEntry } from "@/sim/types";
import { entryKey, entryTime, stepFrom, TRACK_LABELS } from "../model/view";

export interface TimelineTableProps {
  set: EvidenceSet;
  /** The filtered entries, in order: the same list the tracks draw. */
  entries: readonly TimelineEntry[];
  cursor: TimelineEntry | undefined;
  selected: TimelineEntry | undefined;
  /** Keys of the moments lit up around the chosen one. */
  highlighted: ReadonlySet<string>;
  pinned: ReadonlySet<string>;
  local: boolean;
  onMove: (entry: TimelineEntry) => void;
  onSelect: (entry: TimelineEntry) => void;
  onClearSelection: () => void;
  onTogglePin: (entry: TimelineEntry) => void;
  onToggleZone: () => void;
}

/** Rows listed at once. A case has a few hundred moments; the rest are a page away. */
export const TABLE_PAGE = 100;

/**
 * The accessible form of the tracks (docs/plan/09-timeline.md §The view): the same moments, with
 * the same filters, in a real table. It shares the tracks' cursor and chosen moment, so switching
 * views keeps your place.
 *
 * The rows are one tab stop. Up and Down move (Shift for ten), Home and End jump to the ends,
 * Enter chooses the moment, P pins it, Z switches clocks and Escape lets go. The table lists a
 * page of rows around the cursor; moving past the edge of a page turns it.
 */
export function TimelineTable({
  set,
  entries,
  cursor,
  selected,
  highlighted,
  pinned,
  local,
  onMove,
  onSelect,
  onClearSelection,
  onTogglePin,
  onToggleZone,
}: TimelineTableProps) {
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const cursorKey = cursor && entryKey(cursor);
  const selectedKey = selected && entryKey(selected);
  const focusCursor = useRef(false);

  const index = Math.max(0, cursorKey ? entries.findIndex((e) => entryKey(e) === cursorKey) : 0);
  const page = Math.floor(index / TABLE_PAGE);
  const start = page * TABLE_PAGE;
  const rows = entries.slice(start, start + TABLE_PAGE);
  const activeKey = rows.some((e) => entryKey(e) === cursorKey)
    ? cursorKey
    : rows[0] && entryKey(rows[0]);

  // After a key moves the cursor (perhaps onto another page), focus follows it.
  useEffect(() => {
    if (!focusCursor.current || !activeKey) return;
    focusCursor.current = false;
    rowRefs.current.get(activeKey)?.focus();
  });

  const move = (target: TimelineEntry | undefined) => {
    if (!target) return;
    focusCursor.current = true;
    onMove(target);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, entry: TimelineEntry) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    // On the row's own button, Enter and Space press it.
    const onRow = event.target === event.currentTarget;
    const key = entryKey(entry);
    let handled = true;
    switch (event.key) {
      case "ArrowDown":
        move(stepFrom(entries, key, event.shiftKey ? 10 : 1));
        break;
      case "ArrowUp":
        move(stepFrom(entries, key, event.shiftKey ? -10 : -1));
        break;
      case "Home":
        move(entries[0]);
        break;
      case "End":
        move(entries.at(-1));
        break;
      case "Enter":
        if (onRow) onSelect(entry);
        else handled = false;
        break;
      case "p":
      case "P":
        onTogglePin(entry);
        break;
      case "z":
      case "Z":
        onToggleZone();
        break;
      case "Escape":
        onClearSelection();
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  };

  if (entries.length === 0) {
    return (
      <p className="text-secondary">
        No moments match. Switch a source back on, or clear the range.
      </p>
    );
  }

  const pages = Math.ceil(entries.length / TABLE_PAGE);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-subtle">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Every moment in the timeline, oldest first
            {pages > 1 ? `, rows ${start + 1} to ${start + rows.length} of ${entries.length}` : ""}.
            Up and Down move between rows, Enter chooses one, and P pins it to the case board.
          </caption>
          <thead className="bg-surface-raised text-xs text-secondary">
            <tr>
              <th scope="col" className="px-2.5 py-2 font-semibold whitespace-nowrap">
                {local ? "Time (own clock)" : "Time (UTC)"}
              </th>
              <th scope="col" className="px-2.5 py-2 font-semibold">
                Source
              </th>
              <th scope="col" className="px-2.5 py-2 font-semibold">
                Kind
              </th>
              <th scope="col" className="px-2.5 py-2 font-semibold">
                Summary
              </th>
              <th scope="col" className="px-2.5 py-2 font-semibold">
                <span className="sr-only">Case board</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => {
              const key = entryKey(entry);
              const isSelected = key === selectedKey;
              const lit = !isSelected && highlighted.has(key);
              const isPinned = pinned.has(entry.ref);
              const time = entryTime(set, entry, local);
              return (
                <tr
                  key={key}
                  ref={(element) => {
                    if (element) rowRefs.current.set(key, element);
                    else rowRefs.current.delete(key);
                  }}
                  tabIndex={key === activeKey ? 0 : -1}
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => onSelect(entry)}
                  onKeyDown={(event) => onKeyDown(event, entry)}
                  className={cx(
                    "cursor-default border-t border-subtle align-top",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
                    isSelected
                      ? "bg-surface-overlay"
                      : lit
                        ? "bg-accent-subtle"
                        : "hover:bg-surface-raised",
                  )}
                >
                  <td className="px-2.5 py-1.5 font-mono whitespace-nowrap">
                    {time}
                    {isSelected && (
                      <span className="ml-1.5 font-sans text-xs font-medium text-accent">
                        chosen
                      </span>
                    )}
                    {lit && (
                      <span className="ml-1.5 font-sans text-xs font-medium text-accent">
                        nearby
                      </span>
                    )}
                    {isPinned && (
                      <span className="ml-1.5 font-sans text-xs font-medium text-reward">
                        pinned
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">{TRACK_LABELS[entry.source]}</td>
                  <td className="px-2.5 py-1.5 font-mono">{entry.kind}</td>
                  <td className="max-w-md px-2.5 py-1.5 break-words">
                    {entry.summary}
                    <span className="block font-mono text-xs text-muted">{entry.host}</span>
                  </td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      tabIndex={key === activeKey ? 0 : -1}
                      onClick={(event) => {
                        event.stopPropagation();
                        onTogglePin(entry);
                      }}
                      className="rounded-md border border-subtle px-2 py-0.5 text-xs font-medium whitespace-nowrap text-secondary hover:border-accent hover:text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
                    >
                      {isPinned ? "Unpin" : "Pin"}{" "}
                      <span className="sr-only">
                        {TRACK_LABELS[entry.source]} at {time}
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-secondary">
          <p>
            Rows {start + 1}–{start + rows.length} of {entries.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => move(entries[start - 1])}
              className="rounded px-2 py-1 font-medium hover:bg-surface-overlay hover:text-primary focus-visible:outline-2 focus-visible:outline-focus-ring disabled:opacity-50"
            >
              Earlier moments
            </button>
            <button
              type="button"
              disabled={page >= pages - 1}
              onClick={() => move(entries[start + TABLE_PAGE])}
              className="rounded px-2 py-1 font-medium hover:bg-surface-overlay hover:text-primary focus-visible:outline-2 focus-visible:outline-focus-ring disabled:opacity-50"
            >
              Later moments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
