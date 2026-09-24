# src/features/timeline

The Timeline view (`docs/plan/09-timeline.md` §The view), modelled on Autopsy's Timeline and Timesketch: every moment in the evidence, from every source, as one track per source, with a table of the same moments beside it. It is the case workspace's Timeline pane, registered with one line in `src/features/cases/workspace-panes.ts` and loaded when its tab first opens, so none of it is in a page's first download. The moments come from `buildTimeline` (`src/sim/evidence/timeline.ts`, prompt 09.1), the same list the `timeline` tool prints.

**Where the moments come from.** Memory captures and logs are data nothing can change, so their moments show from the start. A drive's file times come from reading the drive, and the pane has no read path of its own: "Add the drive's file times" reads it through `workstation.browse`, the engine call the disk tools and the Evidence Browser make. It reads a working copy when there is one, otherwise the original through its write-blocker; with the blocker off, that read changes the original and says so, exactly as `timeline` in the terminal would. If the drive changes after it was read (a read around the blocker, Reset machine), its moments come off until it is read again.

- `model/view.ts` (pure): track labels, `entryKey` (ref plus instant, because a file record gives up to four moments), the filters (sources and a time range), moving between moments (`stepFrom`, `changeTrack` to the nearest moment on the next track, `nearestTo`), `withinWindow` (what lights up around the chosen moment, on every track), the zoom levels (whole range, hours, minutes, seconds) with `viewportFor` and `ticksFor` (a UTC axis), `density` for the overview strip, and `zoneTracks` for the zone banner.
- `model/state.ts` (pure): `timelineViewReducer`, the one state both views read: the cursor (where the keys are), the chosen moment, zoom, UTC or own clocks, hidden sources, the range, tracks or table, and the highlight window. **The two views share one selection** because they share this reducer.
- `components/timeline-pane.tsx`: the pane: reading drives, then `TimelineView`.
- `components/timeline-view.tsx`: `TimelineView`, the toolbar (view, zoom, clock), the filters (source checkboxes, From and To in UTC, how far to light up), the zone banner, the chosen moment's details with **Pin to the case board**, Show in terminal (`timeline --around <ref>`) and, for a file, Show in Evidence Browser, and the live region.
- `components/timeline-tracks.tsx`: the tracks on a `<canvas>`, the axis, and the whole-case strip underneath, where dragging selects a range (the brush) and a click goes to the nearest moment.
- `components/timeline-table.tsx`: the accessible form: the same filtered moments in a real table, a page of 100 rows around the cursor.

**Keyboard.** On the tracks: ←/→ previous or next moment on this track, Shift+←/→ ten at a time, Home and End, ↑/↓ the nearest moment on the track above or below, + and − zoom, Enter chooses, P pins or unpins, Z switches between UTC and each source's own clock, Escape lets go of the chosen moment. In the table: ↑/↓ (Shift for ten), Home, End, Enter, P, Z and Escape the same way; moving past a page turns it. The brush's keyboard form is the From and To fields. The case board's "Show in timeline" arrives as a `reveal` prop and chooses that moment, switching its source back on and clearing a range that hides it.

**Accessibility.** A canvas says nothing to a screen reader, so the focusable area around it (`role="application"`, described by the visible key list) has the keyboard map, and a polite live region says where each key press landed ("Security log, 2026-04-11T07:58:00Z, 4624: …, 3 of 12 on this track"). The table is what axe and screen readers read, with the chosen, nearby and pinned rows said in words, not colour alone. The canvas paints only with the semantic colour tokens, read from the page, so themes apply. **Reduced motion:** a zoom or a move re-centres the tracks with a 150 ms animation; with motion reduced (`useReducedMotion`) it jumps.

**The zone banner** shows when the tracks use different zones: "Security log times are shown in UTC. The Drive's machine kept its own clock in Europe/London (UTC+01:00)…", with both offsets named when the moments span a clock change. The axis is always UTC; the details show a moment on its own clock too, when that differs.

## Frame time with 5,000 moments

Measured by `tests/e2e/timeline-performance.spec.ts` against `/timeline-bench?entries=5000` (`src/app/(dev)/timeline-bench/`, a dev-only page the Playwright server opens with `E2E_FIXTURES=1`): 5,000 made-up moments across six tracks and about a day. Each test records every animation frame's gap during one interaction and fails if the p90 is over 40 ms or any frame is over 350 ms. Measured on 2026-09-24, production build, desktop Chromium, 1280×720:

| Interaction                                                                    | Frames | Median  | p90     | Worst   | fps             |
| ------------------------------------------------------------------------------ | ------ | ------- | ------- | ------- | --------------- |
| Stepping: 60 arrow presses at minute zoom, each re-centring with its animation | 82     | 16.7 ms | 16.7 ms | 16.8 ms | 60.0            |
| Zooming: + + + − − −, four rounds, each animated                               | 140    | 16.7 ms | 16.7 ms | 16.8 ms | 60.0            |
| Brushing: a 60-step drag across the whole-case strip                           | 102    | 16.7 ms | 16.7 ms | 16.8 ms | 60.0            |
| Same, CPU throttled 4× (a stand-in for a mid laptop): stepping                 | 113    | 16.7 ms | 16.7 ms | 16.8 ms | 60.0            |
| Zooming, 4× throttled                                                          | 161    | 16.7 ms | 16.7 ms | 33.4 ms | 59.3 (2 missed) |
| Brushing, 4× throttled                                                         | 136    | 16.7 ms | 16.7 ms | 33.4 ms | 59.6 (1 missed) |

No frame was dropped unthrottled. Canvas rather than SVG is why: a redraw only walks the moments in view (a binary search on the sorted list), batches them into three `Path2D`s, and never touches the DOM. The throttled rows were a one-off run with `Emulation.setCPUThrottlingRate` added to the spec's `openBench`; the spec in CI runs unthrottled.

Never import here: another feature's internals (types from `@/features/cases` only), `src/app`, or browser storage. Import the engine only through `@/sim` and `@/sim/types`.
