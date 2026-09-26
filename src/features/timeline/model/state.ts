import type { TimelineSource } from "@/sim/types";
import { DEFAULT_HIGHLIGHT_MS, zoomStep, type TimeRange, type ZoomLevel } from "./view";

/**
 * The Timeline pane's state, one reducer for both views: the tracks and the table read the same
 * cursor and the same chosen moment, so switching between them never loses your place
 * (docs/plan/09-timeline.md §The view: "The two views share one selection").
 *
 * The cursor is where the keyboard is (arrow keys move it); the chosen moment is the one whose
 * details show and whose neighbours light up (Enter or a click chooses it). Both are entry keys
 * (`entryKey`), so they survive the entries being rebuilt.
 */
export interface TimelineViewState {
  readonly cursor?: string;
  readonly selected?: string;
  readonly zoom: ZoomLevel;
  /** Each entry on its own source's clock, instead of UTC. */
  readonly local: boolean;
  readonly hidden: readonly TimelineSource[];
  readonly range?: TimeRange;
  readonly mode: TimelineMode;
  /** How far either side of the chosen moment lights up. */
  readonly highlightMs: number;
}

export type TimelineMode = "tracks" | "table";

export const INITIAL_VIEW: TimelineViewState = {
  zoom: "all",
  local: false,
  hidden: [],
  mode: "tracks",
  highlightMs: DEFAULT_HIGHLIGHT_MS,
};

export type TimelineViewAction =
  | { readonly type: "move"; readonly key: string }
  /** Move to an entry and choose it: a click, Enter, or a request from another pane. */
  | { readonly type: "select"; readonly key: string }
  | { readonly type: "clearSelection" }
  | { readonly type: "zoom"; readonly direction: 1 | -1 }
  | { readonly type: "setZoom"; readonly zoom: ZoomLevel }
  | { readonly type: "toggleZone" }
  | { readonly type: "toggleSource"; readonly source: TimelineSource }
  | { readonly type: "showSource"; readonly source: TimelineSource }
  | { readonly type: "setRange"; readonly range: TimeRange | undefined }
  | { readonly type: "setMode"; readonly mode: TimelineMode }
  | { readonly type: "setHighlight"; readonly ms: number };

export function timelineViewReducer(
  state: TimelineViewState,
  action: TimelineViewAction,
): TimelineViewState {
  switch (action.type) {
    case "move":
      return state.cursor === action.key ? state : { ...state, cursor: action.key };
    case "select":
      return { ...state, cursor: action.key, selected: action.key };
    case "clearSelection":
      return state.selected === undefined ? state : without(state, "selected");
    case "zoom":
      return { ...state, zoom: zoomStep(state.zoom, action.direction) };
    case "setZoom":
      return { ...state, zoom: action.zoom };
    case "toggleZone":
      return { ...state, local: !state.local };
    case "toggleSource":
      return {
        ...state,
        hidden: state.hidden.includes(action.source)
          ? state.hidden.filter((source) => source !== action.source)
          : [...state.hidden, action.source],
      };
    case "showSource":
      return state.hidden.includes(action.source)
        ? { ...state, hidden: state.hidden.filter((source) => source !== action.source) }
        : state;
    case "setRange": {
      if (action.range) {
        const { from, to } = action.range;
        return { ...state, range: from <= to ? { from, to } : { from: to, to: from } };
      }
      return state.range === undefined ? state : without(state, "range");
    }
    case "setMode":
      return { ...state, mode: action.mode };
    case "setHighlight":
      return { ...state, highlightMs: action.ms };
  }
}

/** `state` without one of its optional fields. */
function without(
  state: TimelineViewState,
  key: "cursor" | "selected" | "range",
): TimelineViewState {
  const next = { ...state };
  delete next[key];
  return next;
}
