# 09 — Super-timeline: the `timeline` tool and the Timeline view

**Wave 4 · parallel with 07, 08, 10 · 4–5 days**
**Depends on:** 02, 05 (pane registry)
**Owns:** `src/sim/evidence/timeline.ts`, `src/sim/tools/forensics/timeline.ts`, `src/features/timeline/**`

## Goal

Merge every artefact into one ordered list of moments, and show it as tracks per source where clicking one moment lights up the same moment everywhere else. This is where most "aha" moments happen, so it has to be fast, clear, and fully usable without a mouse.

## Spec

### The model (pure)

`buildTimeline(set: EvidenceSet): TimelineEntry[]` where

```ts
interface TimelineEntry { at: Instant; source: "disk" | "memory" | LogSource; kind: string;   // "M", "A", "C", "B", "process-start", "4624"…
                          summary: string; ref: ArtefactRef; host: string }
```

Disk records give up to four entries (one per MACB letter, merged into one entry when the times are equal, shown as `MACB`/`M.C.` style). Memory gives process starts and connection creations. Logs give one entry each. Sorted by `at`, then source, then ref: stable and deterministic.

### The tool

`timeline [--from t] [--to t] [--source s,…] [--around <ref> [--window 5m]] [--zone utc|local]` prints a plaso-like line format written from scratch (`time | source | kind | host | summary`) with refs. `--around` is the key teaching move: everything within a window of one pinned moment. Real-world equivalent: Plaso/log2timeline + psort, Autopsy Timeline, Timesketch.

### The view

- Horizontal tracks per source, zoomable (hour → minute → second), with a brush for range selection. Canvas or SVG, whichever keeps 5,000 entries at 60 fps on a mid laptop. Measure it.
- Click or Enter on an entry: selects it, highlights entries within ±N seconds on every track, and shows details with a Pin button.
- **Keyboard:** ←/→ previous/next entry, Shift+←/→ jump 10, ↑/↓ change track, +/− zoom, Enter select, `p` pin, `z` toggle UTC/local.
- **Accessible form:** a table view of the same entries (toggle, like Internet Visualizer's canvases), with the same filters, which axe and screen readers use. The two views share one selection.
- Reduced motion: no animated zoom.
- A zone banner when sources use different zones: "Security log times are shown in UTC. The laptop's own clock was in Europe/London (UTC+1)." This sets up Case 2's lesson.

Register as the **Timeline** pane with one line in `workspace-panes.ts`. Loaded on demand.

## Prompt 09.1 — model and tool

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md and docs/plan/09-timeline.md.
Build buildTimeline in src/sim/evidence/timeline.ts and the timeline tool in
src/sim/tools/forensics/timeline.ts (one registration line in index.ts), with a man page ("Real-world
equivalent"), refs, and beginner explainer lines. Tests: ordering stability, MACB merging, --around
windows, zone rendering, and a property test that every entry's `at` equals the instant on the
artefact its ref resolves to.
You own only the paths under "Owns" in 09. Agents are working on 07, 08 and 10 at the same time.
Finish with pnpm lint, pnpm typecheck and pnpm test green, then commit.
```

## Prompt 09.2 — Timeline view

```text
Read docs/plan/00-overview.md and docs/plan/09-timeline.md (§The view). Read the relevant guides in
node_modules/next/dist/docs/ if you touch routing or dynamic imports.
Build src/features/timeline/ as specified: tracks, zoom and brush, cross-highlighting, detail with
Pin, the keyboard map, the table view sharing the selection, the zone banner, reduced motion.
Register it as the Timeline pane (one line in src/features/cases/workspace-panes.ts).
Measure frame time with 5,000 generated entries and record the result in src/features/timeline/README.md.
Component tests for keyboard navigation and shared selection; add to the Playwright workspace spec:
open the timeline, step with the keyboard, pin an entry, see it on the board. axe must pass.
Check pnpm bundle:check still passes. Commit when green.
```

## Done when

- [ ] Every entry's time equals its artefact's time (property test)
- [ ] 5,000 entries stay smooth, measured and written down
- [ ] Everything in the view can be done from the keyboard and from the table view
