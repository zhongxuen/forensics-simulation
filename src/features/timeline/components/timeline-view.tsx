"use client";

import { useId, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";
import { useElementWidth } from "@/hooks/use-element-width";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { formatInstant, parseRef, sourceZone, UTC_ZONE } from "@/sim";
import type { EvidenceSet, TimelineEntry } from "@/sim/types";
import { INITIAL_VIEW, timelineViewReducer, type TimelineMode } from "../model/state";
import {
  applyFilter,
  describeKind,
  entryKey,
  entrySentence,
  entryTime,
  extentOf,
  HIGHLIGHT_WINDOWS,
  listWords,
  onTrack,
  sourcesIn,
  TRACK_LABELS,
  viewportFor,
  visibleSources,
  withinWindow,
  zoneTracks,
  zoomLabel,
  ZOOM_LEVELS,
  type TimeRange,
} from "../model/view";
import { TimelineTable } from "./timeline-table";
import { TimelineTracks } from "./timeline-tracks";

/**
 * From this many pixels of pane width (Focus pane on a laptop), the filters and the chosen
 * moment's details move to a column beside the tracks, so the tracks keep the top of the pane.
 */
export const TIMELINE_WIDE_FROM_PX = 900;

export interface TimelineViewProps {
  /** The evidence the entries came from: for the zones each source kept. */
  set: EvidenceSet;
  /** `buildTimeline`'s entries, in its order. */
  entries: readonly TimelineEntry[];
  /** Refs on the case board. */
  pins: readonly string[];
  onPin: (ref: string) => void;
  onUnpin: (ref: string) => void;
  /** Puts a command at the terminal's prompt, unrun. */
  showInTerminal?: (line: string) => void;
  /** Opens a file's record in the Evidence Browser. */
  showInEvidence?: (ref: string) => void;
  /**
   * "Explain this" on the chosen moment (docs/plan/14-mentor.md §Spec). What is sent is the
   * entry's own sentence, the same one screen readers hear. Absent when the mentor isn't wired in.
   */
  explainEntry?: (entry: TimelineEntry) => void;
  /** A request from another pane to bring a ref into view. A new request has a new id. */
  reveal?: { readonly ref: string; readonly id: number };
  /** Said when `reveal` names nothing on the timeline (a drive whose times aren't added yet). */
  missing?: (ref: string) => string;
}

/**
 * The Timeline view (docs/plan/09-timeline.md §The view): the tracks or the table over the same
 * filtered moments, the zone banner, the filters, and the chosen moment's details with its Pin
 * button. The pane (timeline-pane.tsx) feeds it from the case; the frame-time bench feeds it
 * thousands of made-up moments.
 *
 * It lays itself out for the room the pane gives it. Narrow (beside the terminal), the filters
 * fold into a bar above the tracks. Wide (Focus pane), the tracks take the main column at full
 * height and the filters and details sit in a column beside them. The keys are the same in both.
 */
export function TimelineView({
  set,
  entries,
  pins,
  onPin,
  onUnpin,
  showInTerminal,
  showInEvidence,
  explainEntry,
  reveal,
  missing,
}: TimelineViewProps) {
  const [state, dispatch] = useReducer(timelineViewReducer, INITIAL_VIEW);
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion(rootRef);
  // Unmeasured (no layout, as in a test) counts as wide: everything open at once.
  const width = useElementWidth(rootRef);
  const wide = width === undefined || width >= TIMELINE_WIDE_FROM_PX;
  const baseId = useId();
  const keysId = `${baseId}-keys`;

  const announce = (text: string) =>
    setAnnouncement((previous) => (previous === text ? `${text} ` : text));

  const allTracks = useMemo(() => sourcesIn(entries), [entries]);
  const overview = useMemo(() => visibleSources(entries, state.hidden), [entries, state.hidden]);
  const shown = useMemo(
    () =>
      applyFilter(entries, { hidden: state.hidden, ...(state.range && { range: state.range }) }),
    [entries, state.hidden, state.range],
  );
  const tracks = allTracks.filter((source) => !state.hidden.includes(source));
  const byKey = useMemo(() => new Map(shown.map((entry) => [entryKey(entry), entry])), [shown]);
  const cursor = state.cursor === undefined ? undefined : byKey.get(state.cursor);
  const selected = state.selected === undefined ? undefined : byKey.get(state.selected);
  const pinned = useMemo(() => new Set(pins), [pins]);

  const nearby = useMemo(
    () => (selected ? withinWindow(shown, selected, state.highlightMs) : []),
    [shown, selected, state.highlightMs],
  );
  const highlighted = useMemo(() => new Set(nearby.map(entryKey)), [nearby]);

  const extent = state.range ?? extentOf(shown);
  const centre = cursor?.at ?? selected?.at ?? (extent ? (extent.from + extent.to) / 2 : 0);
  const viewport = extent ? viewportFor(state.zoom, extent, centre) : undefined;

  // A request from the case board: find the ref, show its source and range, and choose it
  // (adjusting state while rendering, once per request).
  const [revealed, setRevealed] = useState<number>();
  if (reveal && reveal.id !== revealed) {
    setRevealed(reveal.id);
    const found = entries.find((entry) => entry.ref === reveal.ref);
    if (!found) {
      announce(missing?.(reveal.ref) ?? `${reveal.ref} has no moment on the timeline.`);
    } else {
      dispatch({ type: "showSource", source: found.source });
      if (state.range && (found.at < state.range.from || found.at > state.range.to)) {
        dispatch({ type: "setRange", range: undefined });
      }
      dispatch({ type: "select", key: entryKey(found) });
      if (state.zoom === "all") dispatch({ type: "setZoom", zoom: "minutes" });
      announce(`Showing ${entrySentence(set, found, state.local)}`);
    }
  }

  const togglePin = (entry: TimelineEntry) => {
    const what = `the ${TRACK_LABELS[entry.source]} moment at ${entryTime(set, entry, state.local)}`;
    if (pinned.has(entry.ref)) {
      onUnpin(entry.ref);
      announce(`Took ${what} off the case board.`);
    } else {
      onPin(entry.ref);
      announce(`Pinned ${what} to the case board.`);
    }
  };

  const select = (entry: TimelineEntry) => {
    dispatch({ type: "select", key: entryKey(entry) });
    const around = withinWindow(shown, entry, state.highlightMs).length - 1;
    const window = HIGHLIGHT_WINDOWS.find((w) => w.ms === state.highlightMs)?.label ?? "";
    announce(
      `Chose ${entrySentence(set, entry, state.local)}. ` +
        `${around === 0 ? "Nothing else" : around === 1 ? "1 other moment" : `${around} other moments`} within ${window} ${around === 1 ? "lights" : "light"} up.`,
    );
  };

  /** A move from the tracks: the canvas can't be read, so say where the cursor landed. */
  const moveOnTracks = (entry: TimelineEntry) => {
    dispatch({ type: "move", key: entryKey(entry) });
    const track = onTrack(shown, entry.source);
    const position = track.indexOf(entry) + 1;
    announce(
      `${entrySentence(set, entry, state.local)}. ${position} of ${track.length} on this track` +
        `${pinned.has(entry.ref) ? ", pinned" : ""}${entryKey(entry) === state.selected ? ", chosen" : ""}.`,
    );
  };

  const zoom = (direction: 1 | -1) => {
    dispatch({ type: "zoom", direction });
    const index = ZOOM_LEVELS.findIndex((level) => level.id === state.zoom);
    const next = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index + direction))];
    if (next) announce(`Zoom: ${next.label}.`);
  };

  const toggleZone = () => {
    dispatch({ type: "toggleZone" });
    announce(state.local ? "Times in UTC." : "Times on each source's own clock.");
  };

  const brush = (range: TimeRange | undefined) => {
    dispatch({ type: "setRange", range });
    if (range) dispatch({ type: "setZoom", zoom: "all" });
    announce(
      range
        ? `Showing ${formatInstant(range.from)} to ${formatInstant(range.to)}.`
        : "Showing the whole case.",
    );
  };

  const zones = zoneTracks(set, shown, tracks);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Toggle
        label="View"
        options={[
          ["tracks", "Tracks"],
          ["table", "Table"],
        ]}
        value={state.mode}
        onChange={(mode: TimelineMode) => dispatch({ type: "setMode", mode })}
      />
      <div className="flex items-center gap-1.5" role="group" aria-label="Zoom">
        <Button
          size="sm"
          variant="secondary"
          disabled={state.zoom === "all" || state.mode === "table"}
          onClick={() => zoom(-1)}
        >
          Zoom out
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={state.zoom === "seconds" || state.mode === "table"}
          onClick={() => zoom(1)}
        >
          Zoom in
        </Button>
        <span className="text-sm text-secondary">{zoomLabel(state.zoom)}</span>
      </div>
      <Toggle
        label="Clock"
        options={[
          ["utc", "UTC"],
          ["local", "Own clocks"],
        ]}
        value={state.local ? "local" : "utc"}
        onChange={(value) => {
          if ((value === "local") !== state.local) toggleZone();
        }}
      />
    </div>
  );

  const filters = (
    <Filters
      tracks={allTracks}
      hidden={state.hidden}
      counts={countBySource(entries)}
      onToggle={(source) => dispatch({ type: "toggleSource", source })}
      range={state.range}
      onRange={brush}
      highlightMs={state.highlightMs}
      onHighlight={(ms) => dispatch({ type: "setHighlight", ms })}
      collapsible={!wide}
    />
  );

  const main = (
    <>
      {shown.length === 0 ? (
        <p className="text-secondary">
          No moments match. Switch a source back on, or clear the range.
        </p>
      ) : state.mode === "tracks" && viewport ? (
        <div className="space-y-2">
          <TimelineTracks
            entries={shown}
            overview={overview}
            tracks={tracks}
            viewport={viewport}
            cursor={cursor}
            selected={selected}
            highlightMs={state.highlightMs}
            pinned={pinned}
            range={state.range}
            reducedMotion={reducedMotion}
            onMove={moveOnTracks}
            onSelect={select}
            onClearSelection={() => dispatch({ type: "clearSelection" })}
            onTogglePin={togglePin}
            onZoom={zoom}
            onToggleZone={toggleZone}
            onBrush={brush}
            describedBy={keysId}
          />
          <p id={keysId} className="text-sm leading-6 text-secondary">
            Keys: <Kbd>←</Kbd> <Kbd>→</Kbd> move along a track (with <Kbd>Shift</Kbd>, ten at a
            time), <Kbd>↑</Kbd> <Kbd>↓</Kbd> change track, <Kbd>+</Kbd> <Kbd>−</Kbd> zoom,{" "}
            <Kbd>Enter</Kbd> choose, <Kbd>P</Kbd> pin, <Kbd>Z</Kbd> UTC or own clocks. Drag across
            the whole-case strip to show only that stretch. The axis is always UTC.
          </p>
        </div>
      ) : (
        <TimelineTable
          set={set}
          entries={shown}
          cursor={cursor}
          selected={selected}
          highlighted={highlighted}
          pinned={pinned}
          local={state.local}
          onMove={(entry) => dispatch({ type: "move", key: entryKey(entry) })}
          onSelect={select}
          onClearSelection={() => dispatch({ type: "clearSelection" })}
          onTogglePin={togglePin}
          onToggleZone={toggleZone}
        />
      )}
    </>
  );

  const details = (
    <>
      {selected ? (
        <EntryDetail
          set={set}
          entry={selected}
          pinned={pinned.has(selected.ref)}
          nearby={nearby.length - 1}
          nearbySources={new Set(nearby.map((entry) => entry.source)).size}
          windowLabel={HIGHLIGHT_WINDOWS.find((w) => w.ms === state.highlightMs)?.label ?? ""}
          onTogglePin={() => togglePin(selected)}
          {...(showInTerminal && {
            onShowInTerminal: () => showInTerminal(`timeline --around ${selected.ref}`),
          })}
          {...(showInEvidence &&
            parseRef(selected.ref)?.kind === "file" && {
              onShowInEvidence: () => showInEvidence(selected.ref),
            })}
          {...(explainEntry && { onExplain: () => explainEntry(selected) })}
        />
      ) : (
        shown.length > 0 && (
          <p className="text-sm leading-6 text-secondary">
            Choose a moment to see its details: click it, or move to it with the arrow keys and
            press Enter. Everything close to it in time lights up on every track.
          </p>
        )
      )}
    </>
  );

  return (
    <div ref={rootRef} data-layout={wide ? "wide" : "narrow"} className="space-y-4">
      {zones.mixed && <ZoneBanner zones={zones} local={state.local} />}
      {toolbar}
      {wide ? (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] items-start gap-5">
          <div className="min-w-0 space-y-4">{main}</div>
          <div className="min-w-0 space-y-4">
            {filters}
            {details}
          </div>
        </div>
      ) : (
        <>
          {filters}
          {main}
          {details}
        </>
      )}

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function countBySource(entries: readonly TimelineEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.source, (counts.get(entry.source) ?? 0) + 1);
  return counts;
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-subtle bg-surface-raised px-1 font-mono text-xs">
      {children}
    </kbd>
  );
}

/** A small segmented control: buttons that say which one is on with aria-pressed. */
function Toggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span aria-hidden="true" className="text-sm text-secondary">
        {label}
      </span>
      <div className="flex rounded-md border border-strong p-0.5">
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className={cx(
              "rounded px-2.5 py-1 text-sm font-medium",
              "focus-visible:outline-2 focus-visible:outline-focus-ring",
              // A state, not an action (UIUX §3.3): a tint with an amber edge, never a solid fill.
              value === id
                ? "bg-accent-subtle text-primary ring-1 ring-accent ring-inset"
                : "text-secondary hover:bg-surface-overlay hover:text-primary",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function ZoneBanner({ zones, local }: { zones: ReturnType<typeof zoneTracks>; local: boolean }) {
  const utc = zones.utc.map((source) => TRACK_LABELS[source]);
  return (
    <Callout kind="info" title="Time zones">
      {local ? (
        <p>
          Each time is on its own source&apos;s clock:{" "}
          {listWords(
            zones.zoned.map(
              (track) => `the ${TRACK_LABELS[track.source]} in ${track.zone} (${track.offsets})`,
            ),
          )}
          {utc.length > 0 && <>, and the {listWords(utc)} in UTC</>}. The same moment can show
          different hours on two tracks, so compare the offsets, not the hours. The order is always
          by the real moment.
        </p>
      ) : (
        <p>
          {utc.length > 0 && <>{listWords(utc)} times are shown in UTC. </>}
          {zones.zoned.map((track) => (
            <span key={track.source}>
              The {TRACK_LABELS[track.source]}&apos;s machine kept its own clock in {track.zone} (
              {track.offsets}).{" "}
            </span>
          ))}
          Everything here is in UTC. Choose <strong>Own clocks</strong> (or press{" "}
          <kbd className="font-mono">Z</kbd>) to see each time as its machine showed it.
        </p>
      )}
    </Callout>
  );
}

function Filters({
  tracks,
  hidden,
  counts,
  onToggle,
  range,
  onRange,
  highlightMs,
  onHighlight,
  collapsible,
}: {
  tracks: readonly TimelineEntry["source"][];
  hidden: readonly TimelineEntry["source"][];
  counts: ReadonlyMap<string, number>;
  onToggle: (source: TimelineEntry["source"]) => void;
  range: TimeRange | undefined;
  onRange: (range: TimeRange | undefined) => void;
  highlightMs: number;
  onHighlight: (ms: number) => void;
  /** Folds behind a Filters button (the narrow layout), with a line saying what's on. */
  collapsible: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: "", to: "" });
  const expanded = !collapsible || open;
  const shownRange = range ? { from: inputValue(range.from), to: inputValue(range.to) } : draft;
  const setEnd = (end: "from" | "to", value: string) => {
    const next = { ...shownRange, [end]: value };
    setDraft(next);
    const from = parseUtc(next.from);
    const to = parseUtc(next.to);
    if (from !== undefined && to !== undefined) onRange({ from, to });
  };

  const showWhole = range && (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        setDraft({ from: "", to: "" });
        onRange(undefined);
      }}
    >
      Show the whole case
    </Button>
  );
  const on = tracks.length - hidden.filter((source) => tracks.includes(source)).length;

  return (
    <div className="space-y-3 rounded-md border border-subtle bg-surface-raised px-3 py-3">
      {collapsible && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={() => setOpen(!open)}
            className={cx(
              "flex items-center gap-1.5 rounded px-1 text-sm font-semibold hover:text-primary",
              FOCUS_RING,
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                "inline-block transition-transform fx-duration-fast",
                open && "rotate-90",
              )}
            >
              ▸
            </span>
            Filters
          </button>
          <span className="text-sm text-secondary">
            {on} of {tracks.length} {tracks.length === 1 ? "source" : "sources"},{" "}
            {range ? "a stretch of the case" : "the whole case"}
          </span>
          {!open && showWhole}
        </div>
      )}
      <div
        id={`${id}-body`}
        hidden={!expanded}
        className={cx("space-y-3", collapsible && "animate-fade-in border-t border-subtle pt-3")}
      >
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <legend className="mb-1 text-sm font-semibold">Sources</legend>
          {tracks.map((source) => (
            <label key={source} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={!hidden.includes(source)}
                onChange={() => onToggle(source)}
                className="size-4 accent-accent"
              />
              {TRACK_LABELS[source]} <span className="text-muted">({counts.get(source) ?? 0})</span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm" htmlFor={`${id}-from`}>
            From (UTC)
            <input
              id={`${id}-from`}
              type="datetime-local"
              step={1}
              value={shownRange.from}
              onChange={(event) => setEnd("from", event.target.value)}
              className={cx(FIELD, "font-mono")}
            />
          </label>
          <label className="grid gap-1 text-sm" htmlFor={`${id}-to`}>
            To (UTC)
            <input
              id={`${id}-to`}
              type="datetime-local"
              step={1}
              value={shownRange.to}
              onChange={(event) => setEnd("to", event.target.value)}
              className={cx(FIELD, "font-mono")}
            />
          </label>
          {expanded && showWhole}
          <label className="grid gap-1 text-sm" htmlFor={`${id}-near`}>
            Light up moments within
            <select
              id={`${id}-near`}
              value={highlightMs}
              onChange={(event) => onHighlight(Number(event.target.value))}
              className={FIELD}
            >
              {HIGHLIGHT_WINDOWS.map((window) => (
                <option key={window.ms} value={window.ms}>
                  {window.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

/** A form field on the pane's surfaces: the date and time inputs and the select. */
const FIELD = cx(
  "h-8 rounded-md border border-strong bg-surface-base px-2 text-sm text-primary hover:border-accent",
  "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70",
  FOCUS_RING,
);

/** An instant as a datetime-local input's value, in UTC, to the second. */
function inputValue(at: number): string {
  return new Date(at).toISOString().slice(0, 19);
}

/** A datetime-local value read as UTC. */
function parseUtc(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return undefined;
  const [y, mo, d, h, mi, s] = match.slice(1).map((part) => Number(part ?? 0)) as number[];
  const at = Date.UTC(y ?? 0, (mo ?? 1) - 1, d, h, mi, Number.isNaN(s) ? 0 : s);
  return Number.isNaN(at) ? undefined : at;
}

function EntryDetail({
  set,
  entry,
  pinned,
  nearby,
  nearbySources,
  windowLabel,
  onTogglePin,
  onShowInTerminal,
  onShowInEvidence,
  onExplain,
}: {
  set: EvidenceSet;
  entry: TimelineEntry;
  pinned: boolean;
  nearby: number;
  nearbySources: number;
  windowLabel: string;
  onTogglePin: () => void;
  onShowInTerminal?: () => void;
  onShowInEvidence?: () => void;
  onExplain?: () => void;
}) {
  const id = useId();
  const utc = entryTime(set, entry, false);
  const own = sourceZone(set, entry.source) === UTC_ZONE ? utc : entryTime(set, entry, true);
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-lg border border-subtle bg-surface-raised px-4 py-3"
    >
      <h4 id={`${id}-title`} className="font-semibold">
        The chosen moment
      </h4>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-secondary">When (UTC)</dt>
        <dd className="font-mono">{utc}</dd>
        {own !== utc && (
          <>
            <dt className="text-secondary">On its own clock</dt>
            <dd className="font-mono">{own}</dd>
          </>
        )}
        <dt className="text-secondary">Source</dt>
        <dd>
          {TRACK_LABELS[entry.source]}, on <span className="font-mono">{entry.host}</span>
        </dd>
        <dt className="text-secondary">Kind</dt>
        <dd>
          <span className="font-mono">{entry.kind}</span>: {describeKind(entry)}
        </dd>
        <dt className="text-secondary">What happened</dt>
        <dd className="break-words">{entry.summary}</dd>
        <dt className="text-secondary">Ref</dt>
        <dd className="font-mono break-all">{entry.ref}</dd>
      </dl>
      <p className="text-sm leading-6 text-secondary">
        {nearby === 0
          ? `Nothing else happened within ${windowLabel} of this.`
          : `${nearby} other ${nearby === 1 ? "moment" : "moments"} within ${windowLabel}, on ${nearbySources} ${nearbySources === 1 ? "track" : "tracks"}, ${nearby === 1 ? "is" : "are"} lit up.`}
        {parseRef(entry.ref)?.kind === "file" &&
          " Pinning a file puts its record on the board, with all four of its times."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={pinned ? "secondary" : "primary"} onClick={onTogglePin}>
          {pinned ? "Unpin from the case board" : "Pin to the case board"}
        </Button>
        {onShowInTerminal && (
          <Button size="sm" variant="secondary" onClick={onShowInTerminal}>
            Show in terminal
          </Button>
        )}
        {onShowInEvidence && (
          <Button size="sm" variant="secondary" onClick={onShowInEvidence}>
            Show in Evidence Browser
          </Button>
        )}
        {onExplain && (
          <Button size="sm" variant="ghost" onClick={onExplain}>
            Explain this
          </Button>
        )}
      </div>
    </section>
  );
}
