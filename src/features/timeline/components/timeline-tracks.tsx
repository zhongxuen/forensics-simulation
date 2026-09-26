"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { cx } from "@/lib/cx";
import type { TimelineEntry, TimelineSource } from "@/sim/types";
import {
  changeTrack,
  density,
  entryKey,
  lowerBound,
  nearestTo,
  onTrack,
  stepFrom,
  ticksFor,
  TRACK_LABELS,
  upperBound,
  type TimeRange,
} from "../model/view";

export interface TimelineTracksProps {
  /** What the tracks draw: the filtered entries, in order. */
  entries: readonly TimelineEntry[];
  /** What the overview strip draws: every entry on a shown source, the whole case. */
  overview: readonly TimelineEntry[];
  tracks: readonly TimelineSource[];
  /** The stretch of time the tracks show. Changes are animated unless motion is reduced. */
  viewport: TimeRange;
  cursor: TimelineEntry | undefined;
  selected: TimelineEntry | undefined;
  /** How far either side of the chosen moment lights up. */
  highlightMs: number;
  /** Refs on the case board. */
  pinned: ReadonlySet<string>;
  range: TimeRange | undefined;
  reducedMotion: boolean;
  onMove: (entry: TimelineEntry) => void;
  onSelect: (entry: TimelineEntry) => void;
  onClearSelection: () => void;
  onTogglePin: (entry: TimelineEntry) => void;
  onZoom: (direction: 1 | -1) => void;
  onToggleZone: () => void;
  onBrush: (range: TimeRange | undefined) => void;
  /** The id of the text that lists the keys. */
  describedBy: string;
}

const AXIS_H = 22;
const ROW_H = 30;
const OVERVIEW_H = 34;
const MAX_LABEL_W = 116;
/** How close, in pixels, a click must land to a moment to choose it. */
const HIT_PX = 8;
/** A drag shorter than this on the overview is a click. */
const DRAG_PX = 4;
const ANIMATION_MS = 150;

/** The semantic colour tokens the canvas paints with, read from the page so themes apply. */
const TOKENS = {
  text: "--text-primary",
  secondary: "--text-secondary",
  muted: "--text-muted",
  accent: "--accent",
  accentSubtle: "--accent-subtle",
  reward: "--reward",
  focus: "--focus-ring",
  grid: "--border-subtle",
  band: "--surface-overlay",
} as const;

type Palette = Record<keyof typeof TOKENS, string>;

function readPalette(element: Element): Palette {
  const style = getComputedStyle(element);
  const palette = {} as Palette;
  for (const [name, token] of Object.entries(TOKENS) as [keyof Palette, string][]) {
    palette[name] = style.getPropertyValue(token).trim() || "currentColor";
  }
  return palette;
}

/**
 * The tracks: one row per source, every moment a mark at its instant, the axis in UTC across the
 * top and an overview of the whole case underneath, where dragging selects a range (the brush).
 * Drawn on a canvas, so thousands of moments redraw inside a frame; the README has the numbers.
 *
 * A canvas says nothing to a screen reader, so the focusable area around it carries the keyboard
 * map and the pane announces each moment the cursor lands on. The table view is the same list
 * with real table semantics.
 *
 * Keys: ←/→ previous or next moment on this track, Shift+←/→ ten at a time, Home and End, ↑/↓
 * the nearest moment on the track above or below, + and − zoom, Enter chooses, P pins, Z
 * switches between UTC and each source's own clock, Escape lets go of the chosen moment.
 */
export function TimelineTracks(props: TimelineTracksProps) {
  const {
    entries,
    tracks,
    cursor,
    reducedMotion,
    onMove,
    onSelect,
    onClearSelection,
    onTogglePin,
    onZoom,
    onToggleZone,
    onBrush,
    describedBy,
  } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLCanvasElement>(null);
  const overviewRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  // The latest props, for drawing from animation frames without re-subscribing.
  const latest = useRef(props);
  latest.current = props;
  // The viewport as last drawn, which an animation moves towards the target.
  const shown = useRef<TimeRange>(props.viewport);
  const drag = useRef<{ start: number; now: number } | null>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    setWidth(box.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const height = AXIS_H + Math.max(1, tracks.length) * ROW_H;
  const labelW = Math.min(MAX_LABEL_W, Math.round(width * 0.3));

  // Redraw on every change; animate when only the viewport moved and motion is allowed.
  const { from, to } = props.viewport;
  useEffect(() => {
    const target = { from, to };
    const start = shown.current;
    const still = start.from === target.from && start.to === target.to;
    if (reducedMotion || still || width === 0) {
      shown.current = target;
      paint();
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / ANIMATION_MS);
      const eased = 1 - (1 - t) ** 3;
      shown.current = {
        from: start.from + (target.from - start.from) * eased,
        to: start.to + (target.to - start.to) * eased,
      };
      paint();
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // paint reads everything else from `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, reducedMotion, width]);

  // Anything else that changes the picture redraws it at the current viewport.
  useEffect(() => {
    paint();
  });

  function paint() {
    paintTracks();
    paintOverview();
  }

  function setup(canvas: HTMLCanvasElement | null, cssHeight: number) {
    if (!canvas || width === 0) return undefined;
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(width * ratio);
    const h = Math.round(cssHeight * ratio);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, cssHeight);
    return ctx;
  }

  function paintTracks() {
    const canvas = tracksRef.current;
    const ctx = setup(canvas, height);
    if (!ctx || !canvas) return;
    const p = latest.current;
    const colour = readPalette(canvas);
    const font = getComputedStyle(canvas).fontFamily;
    const view = shown.current;
    const plotW = Math.max(1, width - labelW - 8);
    const span = view.to - view.from || 1;
    const x = (at: number) => labelW + ((at - view.from) / span) * plotW;
    const rowOf = new Map(p.tracks.map((source, i) => [source, i]));
    const rowTop = (row: number) => AXIS_H + row * ROW_H;

    // Bands, so the rows read apart, and the labels.
    ctx.font = `12px ${font}`;
    ctx.textBaseline = "middle";
    p.tracks.forEach((source, row) => {
      if (row % 2 === 1) {
        ctx.fillStyle = colour.band;
        ctx.fillRect(0, rowTop(row), width, ROW_H);
      }
      const active = p.cursor?.source === source;
      ctx.fillStyle = active ? colour.text : colour.secondary;
      ctx.font = `${active ? "600 " : ""}12px ${font}`;
      ctx.fillText(TRACK_LABELS[source], 6, rowTop(row) + ROW_H / 2, labelW - 10);
    });

    // The axis: round UTC times, with a line down through every track.
    ctx.font = `11px ${font}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = colour.muted;
    ctx.strokeStyle = colour.grid;
    ctx.lineWidth = 1;
    const ticks = ticksFor(view, Math.max(2, Math.floor(plotW / 90)));
    ctx.beginPath();
    for (const tick of ticks) {
      const tx = Math.round(x(tick.at)) + 0.5;
      ctx.moveTo(tx, AXIS_H - 4);
      ctx.lineTo(tx, height);
      ctx.fillText(tick.label, tx + 3, AXIS_H - 8);
    }
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(labelW, 0, plotW + 8, height);
    ctx.clip();

    // The window around the chosen moment, across every track: what lights up.
    const chosen = p.selected;
    if (chosen) {
      ctx.fillStyle = colour.accentSubtle;
      const left = x(chosen.at - p.highlightMs);
      ctx.fillRect(left, AXIS_H, Math.max(2, x(chosen.at + p.highlightMs) - left), height);
    }

    // Every moment in view, batched by how it's drawn: plain, lit, pinned.
    const first = lowerBound(p.entries, view.from - span * 0.01);
    const last = upperBound(p.entries, view.to + span * 0.01);
    const plain = new Path2D();
    const lit = new Path2D();
    const flags = new Path2D();
    const near = chosen
      ? { from: chosen.at - p.highlightMs, to: chosen.at + p.highlightMs }
      : undefined;
    for (let i = first; i < last; i += 1) {
      const entry = p.entries[i];
      if (!entry) continue;
      const row = rowOf.get(entry.source);
      if (row === undefined) continue;
      const ex = x(entry.at);
      const mid = rowTop(row) + ROW_H / 2;
      if (near && entry.at >= near.from && entry.at <= near.to) lit.rect(ex - 1.5, mid - 9, 3, 18);
      else plain.rect(ex - 1, mid - 6, 2, 12);
      if (p.pinned.has(entry.ref)) {
        flags.moveTo(ex - 4, rowTop(row) + 2);
        flags.lineTo(ex + 4, rowTop(row) + 2);
        flags.lineTo(ex, rowTop(row) + 7);
        flags.closePath();
      }
    }
    ctx.fillStyle = colour.muted;
    ctx.fill(plain);
    ctx.fillStyle = colour.accent;
    ctx.fill(lit);
    ctx.fillStyle = colour.reward;
    ctx.fill(flags);

    // The chosen moment: a full-height bar with a dot. The cursor: a ring around its mark.
    if (chosen) {
      const row = rowOf.get(chosen.source);
      if (row !== undefined) {
        const cx = x(chosen.at);
        ctx.fillStyle = colour.accent;
        ctx.fillRect(cx - 2, rowTop(row) + 3, 4, ROW_H - 6);
        ctx.beginPath();
        ctx.arc(cx, rowTop(row) + ROW_H / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (p.cursor) {
      const row = rowOf.get(p.cursor.source);
      if (row !== undefined) {
        const cx = x(p.cursor.at);
        ctx.strokeStyle = colour.focus;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 7, rowTop(row) + 2, 14, ROW_H - 4);
      }
    }
    ctx.restore();
  }

  function paintOverview() {
    const canvas = overviewRef.current;
    const ctx = setup(canvas, OVERVIEW_H);
    if (!ctx || !canvas) return;
    const p = latest.current;
    const colour = readPalette(canvas);
    const whole = wholeRange(p.overview);
    if (!whole) return;
    const plotW = Math.max(1, width - labelW - 8);
    const span = whole.to - whole.from || 1;
    const x = (at: number) => labelW + ((at - whole.from) / span) * plotW;

    const font = getComputedStyle(canvas).fontFamily;
    ctx.font = `12px ${font}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = colour.secondary;
    ctx.fillText("Whole case", 6, OVERVIEW_H / 2, labelW - 10);

    const bins = Math.max(1, Math.floor(plotW / 3));
    const counts = density(p.overview, whole, bins);
    const top = Math.max(1, ...counts);
    ctx.fillStyle = colour.muted;
    counts.forEach((count, i) => {
      if (count === 0) return;
      const h = Math.max(2, (count / top) * (OVERVIEW_H - 8));
      ctx.fillRect(labelW + (i * plotW) / bins, OVERVIEW_H - 4 - h, 2, h);
    });

    // The brushed range, or the one being dragged out, and the stretch the tracks show.
    const dragging = drag.current;
    const brushed = dragging
      ? {
          left: Math.min(dragging.start, dragging.now),
          right: Math.max(dragging.start, dragging.now),
        }
      : p.range && { left: x(p.range.from), right: x(p.range.to) };
    if (brushed) {
      ctx.fillStyle = colour.accentSubtle;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(brushed.left, 1, Math.max(2, brushed.right - brushed.left), OVERVIEW_H - 2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colour.accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(brushed.left, 1, Math.max(2, brushed.right - brushed.left), OVERVIEW_H - 2);
    }
    const view = shown.current;
    ctx.strokeStyle = colour.secondary;
    ctx.lineWidth = 1;
    const left = Math.max(labelW, x(view.from));
    const right = Math.min(labelW + plotW, x(view.to));
    ctx.strokeRect(left + 0.5, 3.5, Math.max(2, right - left - 1), OVERVIEW_H - 7);
  }

  /** The instant under `clientX` on a canvas, on the given range. */
  function instantAt(canvas: HTMLCanvasElement, clientX: number, range: TimeRange) {
    const plotW = Math.max(1, width - labelW - 8);
    const px = clientX - canvas.getBoundingClientRect().left;
    return { px, at: range.from + ((px - labelW) / plotW) * (range.to - range.from) };
  }

  const onTracksClick = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const row = Math.floor((event.clientY - canvas.getBoundingClientRect().top - AXIS_H) / ROW_H);
    const source = tracks[row];
    if (!source) return;
    const view = shown.current;
    const { at } = instantAt(canvas, event.clientX, view);
    const hit = nearestTo(onTrack(entries, source), at);
    if (!hit) return;
    const pxPerMs = Math.max(1, width - labelW - 8) / (view.to - view.from || 1);
    if (Math.abs(hit.at - at) * pxPerMs > HIT_PX) return;
    onSelect(hit);
  };

  const onOverviewDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const px = event.clientX - event.currentTarget.getBoundingClientRect().left;
    if (px < labelW) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { start: px, now: px };
  };

  const onOverviewMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    drag.current = {
      start: drag.current.start,
      now: event.clientX - event.currentTarget.getBoundingClientRect().left,
    };
    paintOverview();
  };

  const onOverviewUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const started = drag.current;
    drag.current = null;
    const whole = wholeRange(props.overview);
    if (!started || !whole) return;
    const canvas = event.currentTarget;
    const end = instantAt(canvas, event.clientX, whole);
    if (Math.abs(end.px - started.start) < DRAG_PX) {
      // A click: go to the moment nearest there.
      const hit = nearestTo(entries, end.at);
      if (hit) onMove(hit);
      paintOverview();
      return;
    }
    const begin = instantAt(canvas, canvas.getBoundingClientRect().left + started.start, whole);
    onBrush({
      from: Math.round(Math.max(whole.from, Math.min(begin.at, end.at))),
      to: Math.round(Math.min(whole.to, Math.max(begin.at, end.at))),
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const track = cursor ? onTrack(entries, cursor.source) : entries;
    const from = cursor && entryKey(cursor);
    let target: TimelineEntry | undefined;
    let handled = true;
    switch (event.key) {
      case "ArrowRight":
        target = stepFrom(track, from, event.shiftKey ? 10 : 1);
        break;
      case "ArrowLeft":
        target = stepFrom(track, from, event.shiftKey ? -10 : -1);
        break;
      case "Home":
        target = track[0];
        break;
      case "End":
        target = track.at(-1);
        break;
      case "ArrowDown":
      case "ArrowUp":
        target = cursor
          ? changeTrack(
              entries,
              tracks,
              cursor.source,
              event.key === "ArrowDown" ? 1 : -1,
              cursor.at,
            )
          : entries[0];
        break;
      case "+":
      case "=":
        onZoom(1);
        break;
      case "-":
      case "_":
        onZoom(-1);
        break;
      case "Enter":
        if (cursor) onSelect(cursor);
        else if (entries[0]) onSelect(entries[0]);
        break;
      case "p":
      case "P":
        if (cursor) onTogglePin(cursor);
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
    if (target) onMove(target);
    if (handled) event.preventDefault();
  };

  return (
    <div ref={boxRef} className="min-w-0">
      <div
        role="application"
        aria-roledescription="timeline"
        aria-label="Timeline tracks"
        aria-describedby={describedBy}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cx(
          "rounded-md border border-subtle bg-surface-raised",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
        )}
      >
        <canvas
          ref={tracksRef}
          aria-hidden="true"
          onPointerUp={onTracksClick}
          style={{ width: "100%", height }}
          className="block font-mono"
        />
      </div>
      <canvas
        ref={overviewRef}
        aria-hidden="true"
        onPointerDown={onOverviewDown}
        onPointerMove={onOverviewMove}
        onPointerUp={onOverviewUp}
        onPointerCancel={() => {
          drag.current = null;
          paintOverview();
        }}
        style={{ width: "100%", height: OVERVIEW_H }}
        className="mt-2 block cursor-crosshair touch-none rounded-md border border-subtle bg-surface-raised font-mono"
      />
    </div>
  );
}

function wholeRange(entries: readonly TimelineEntry[]): TimeRange | undefined {
  const first = entries[0];
  const last = entries.at(-1);
  if (!first || !last) return undefined;
  const pad = Math.max(1000, (last.at - first.at) * 0.02);
  return { from: first.at - pad, to: last.at + pad };
}
