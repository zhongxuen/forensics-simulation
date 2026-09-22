# 05 — Workspace UI: case runner, terminal wiring, Evidence Browser

**Wave 2 · parallel with 03, 04, 13 · 4–5 days**
**Depends on:** 02 (types only)
**Owns:** `src/features/cases/{run,components,workspace-panes.ts,index.ts}`, `src/features/evidence-browser/**`, `src/app/(app)/cases/**`, `src/lib/case-storage/**`, `src/app/(marketing)/privacy/**`, `tests/components/**` for these, `tests/e2e/case-workspace.spec.ts`

## Goal

The screen a player spends a case in: a briefing, then a workspace with the terminal, the Evidence Browser and slots for the timeline (09) and case board (10), then a debrief. Plus saving a case run in this browser.

## Spec

### Case runner

Model on Hacker Simulation's `MissionRunner` and `missionRunReducer` (`../hacker-simulation/src/features/missions/run/`). `caseRunReducer(state, action)` is pure: briefing → workspace → report → debrief. Objectives tick from engine events (the evaluator comes from 03's schema; use a stub evaluator until 03 merges). Hints are free, tiered and never affect anything else.

The briefing follows Hacker Simulation's cold-open rule: name plus role on each character's first line, at most two lines before the first objective, the client and who signed.

### Workspace layout

- Desktop: terminal on the left (always there), a tabbed right pane: **Evidence** · **Timeline** · **Board** · **Objectives**. Panes register through `src/features/cases/workspace-panes.ts` (`{ id, label, load: () => import(...) }`), so 09 and 10 add a line each and nothing else.
- Mobile (≥ 360 px): one pane at a time, with a tab bar. Terminal input stays usable with an on-screen keyboard.
- The SIMULATED marker is always visible and can't be dismissed.
- Terminal ↔ panes: clicking a record in the Evidence Browser offers "Show in terminal" (types `inode …` for you, doesn't run it). Pins from either place land on the same board.

### Evidence Browser (Autopsy-like)

- **Tree** (left): images → partitions → folders. Deleted items are struck through **and** labelled "deleted" (never colour or strike-through alone).
- **Table** (middle): name, record, size, owner, M, A, C, B. Sortable, filterable (deleted only, changed between two times). A UTC/local toggle with the zone named.
- **Detail** (right): tabs **Text** · **Hex** (offset, 16 bytes, ASCII, virtualised) · **Metadata** · **Real-world equivalent** (the Autopsy view this copies).
- A **Pin** button on the detail view and each row. Keyboard: arrows move, Enter opens, `p` pins.
- Opening a device's original through the browser respects the write-blocker, exactly like the terminal (same engine call). The browser never has its own read path.

### Saving case runs

`src/lib/case-storage/`: key `incident-room:cases:v1`, value `{ v: 1, runs: Record<caseId, CaseRunSave> }` with a Zod schema (`zod/mini`) and a `migrate(unknown)` function. Saves the reducer state that matters (engine command log for replay, pins, notes, report draft, objectives ticked), **not** the engine state. On load, replay the command log (vendored `replay`) to rebuild it. When storage is blocked or full, the game still plays and a calm banner says "This browser isn't letting us save, so this case won't be kept if you close the tab."

`/privacy` ("What we store"): the two keys, what's in each, that nothing leaves the browser except the mentor's request (if used), and **Clear everything** and **Export my cases** / **Import** buttons. Import validates with the schema and never runs anything.

## Prompt 05.1 — runner, layout, storage

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md and docs/plan/05-workspace-ui.md.
Read ../hacker-simulation/src/features/missions/run/ and components/ (MissionRunner,
missionRunReducer, useMissionRun) and src/lib/settings/ as the models to follow. Read the relevant
guides in node_modules/next/dist/docs/ before writing routes.

You own only the paths under "Owns" in 05. Agents are writing the generator (03), disk tools (04) and
lessons (13) at the same time: use a stub objective evaluator and the builder fixtures from
src/sim/evidence/builder.ts until their work merges.

1. caseRunReducer + useCaseRun + the CaseRunner component (briefing → workspace → report placeholder
   → debrief), at /cases and /cases/[slug].
2. The workspace layout and the pane registry in 05 §Workspace layout, with Evidence and Objectives
   panes registered, and Timeline and Board shown as "Arrives in a later update" empty states that
   follow the empty-state template in 99 §Voice.
3. The case-storage module, the replay-on-load, the blocked-storage banner, and /privacy with Clear,
   Export and Import.
4. Component tests for the reducer, storage (including a corrupted value and a v0 value going through
   migrate), and the blocked-storage path.
Finish with pnpm lint, pnpm typecheck, pnpm test and pnpm build green, then commit.
```

## Prompt 05.2 — Evidence Browser

Run after 05.1, same wave.

```text
Read docs/plan/00-overview.md and docs/plan/05-workspace-ui.md (§Evidence Browser).
Build src/features/evidence-browser/ as specified: tree, sortable/filterable table with the UTC/local
toggle, detail tabs (Text, Hex virtualised, Metadata, Real-world equivalent), Pin on rows and detail,
the keyboard map, and "Show in terminal". Every read goes through the engine, so the write-blocker
applies. Register it as the Evidence pane.
A table view is the accessible form: the tree must be fully usable from the keyboard with the ARIA
tree pattern, and axe must pass. Add component tests and a Playwright spec (tests/e2e/case-workspace.spec.ts)
that opens the fixture case, finds a deleted file, pins it from the keyboard, reloads the page, and
sees the pin still there.
Check the evidence-browser chunk loads only when the pane opens (pnpm build && pnpm bundle:check).
Finish with everything green, then commit.
```

## Done when

- [ ] A reload in the middle of a case brings back the terminal history, pins and notes
- [ ] Blocking storage in the browser still lets the case be played start to finish
- [ ] The Evidence Browser is usable with the keyboard only, and axe passes on `/cases/[slug]`
- [ ] Initial JS for `/cases/[slug]` stays under 200 KB
