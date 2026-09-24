# src/features/case-board

The Case Board (`docs/plan/10-case-board-report-custody.md` §Case Board): where findings live. It is the case workspace's Board pane, registered with one line in `src/features/cases/workspace-panes.ts` and loaded when its tab first opens.

- `model/cards.ts` (pure): `boardCards` turns the run's pins into cards — a source badge, the artefact's time in UTC and on its own clock when the two read differently, the output line it was pinned from (the latest `board.pinned` event for the ref) or a row built from the evidence, the ref and the player's note. `groupBySource` and `sortByTime` are the two layouts. `terminalCommandFor` is the command "Show in terminal" puts at the prompt (`inode` on a working copy when there is one), and `showsInEvidenceBrowser` says which refs the Evidence Browser can select.
- `components/case-board-pane.tsx`: the pane. Edit a note, remove a pin (with Undo, which puts it back with its note), and the cross-links: "Show in terminal" through `workstation.showInTerminal`, "Show in Evidence Browser" and "Show in timeline" through `workstation.show(pane, ref)`. The timeline link only shows once a Timeline pane is registered. With nothing pinned, the pane is the empty state from 99 §Voice.

**Pins live in the case run**, not here: `run.pins` (keyed by ref, so pinning the same thing twice is one card) and `run.pinNotes`, saved with the rest of the run by `@/lib/case-storage`. A pin from the terminal and a pin from a view land on the same board.

Never import here: another feature's internals (types from `@/features/cases` only, plus its `WORKSPACE_PANES`), `src/app`, or browser storage.
