"use client";

import { useState, type UIEvent } from "react";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";
import { hexRow, hexRowCount } from "../model/bytes";

/** Every row is one line of text at this height (the `leading-6` below), so rows can be skipped. */
const ROW_HEIGHT = 24;
/** Rows drawn above and below what's on screen, so a fast scroll never shows a gap. */
const OVERSCAN = 8;
/** How many rows fit when the box hasn't been measured (it has no layout yet, or no height). */
const DEFAULT_VISIBLE = 16;

interface HexViewProps {
  bytes: Uint8Array;
  /** What the bytes are, for the region's name: "invoice-viewer.exe". */
  name: string;
}

/**
 * A hex dump: offset, 16 bytes, and the same bytes as ASCII, the way a forensic hex viewer lays
 * them out. Virtualised: only the rows in view (plus a few either side) are in the page, inside a
 * spacer as tall as the whole dump, so a large file scrolls as smoothly as a small one.
 *
 * The box is a focusable, labelled region, so the arrow and page keys scroll it from the keyboard.
 */
export function HexView({ bytes, name }: HexViewProps) {
  const rows = hexRowCount(bytes.length);
  const [first, setFirst] = useState(0);
  const [visible, setVisible] = useState(DEFAULT_VISIBLE);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const box = event.currentTarget;
    setFirst(Math.floor(box.scrollTop / ROW_HEIGHT));
    if (box.clientHeight > 0) setVisible(Math.ceil(box.clientHeight / ROW_HEIGHT));
  };

  if (rows === 0) {
    return <p className="text-secondary">This record has no content bytes: it&apos;s empty.</p>;
  }

  const start = Math.max(0, first - OVERSCAN);
  const end = Math.min(rows, first + visible + OVERSCAN);
  const drawn = Array.from({ length: end - start }, (_, i) => hexRow(bytes, start + i));

  return (
    <div>
      <p className="mb-2 text-sm text-secondary">
        {bytes.length} {bytes.length === 1 ? "byte" : "bytes"}, 16 to a row: the offset of each
        row&apos;s first byte (in hex), the bytes themselves, then the same bytes as text, with a
        dot for any that aren&apos;t printable.
      </p>
      <div
        role="region"
        aria-label={`Hex view of ${name}`}
        tabIndex={0}
        onScroll={onScroll}
        className={cx(
          "max-h-64 overflow-auto rounded-md border border-subtle bg-term-bg font-mono text-xs leading-6 text-term-fg",
          FOCUS_RING,
        )}
      >
        <div style={{ height: rows * ROW_HEIGHT }} className="relative min-w-max">
          <div
            style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}
            className="absolute inset-x-0 top-0 px-3"
          >
            {drawn.map((row) => (
              <div key={row.offset} className="whitespace-pre" data-hex-row={row.offset}>
                <span className="text-term-dim">{row.offset}</span>
                {"  "}
                {row.hex}
                {"  "}
                <span className="text-term-cyan">{row.ascii}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
