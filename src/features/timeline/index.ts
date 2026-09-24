/**
 * The Timeline's public API (docs/plan/09-timeline.md §The view). The case workspace registers
 * `TimelinePane` in its pane registry (`src/features/cases/workspace-panes.ts`) and loads this
 * module when the Timeline tab first opens, so nothing on a page's first download may import it
 * statically.
 */
export { TimelinePane } from "./components/timeline-pane";
export { TimelineView, type TimelineViewProps } from "./components/timeline-view";
export {
  INITIAL_VIEW,
  timelineViewReducer,
  type TimelineMode,
  type TimelineViewAction,
  type TimelineViewState,
} from "./model/state";
export {
  applyFilter,
  changeTrack,
  density,
  describeKind,
  entryKey,
  entrySentence,
  entryTime,
  extentOf,
  HIGHLIGHT_WINDOWS,
  nearestTo,
  onTrack,
  sourcesIn,
  stepFrom,
  ticksFor,
  TRACK_LABELS,
  viewportFor,
  withinWindow,
  zoneTracks,
  zoomStep,
  ZOOM_LEVELS,
  type TimeRange,
  type TimelineFilter,
  type ZoomLevel,
} from "./model/view";
