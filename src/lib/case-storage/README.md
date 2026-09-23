# src/lib/case-storage

Saved case runs (`docs/plan/05-workspace-ui.md` §Saving case runs). Hacker Simulation keeps no progress at all; this game deliberately does, because a case takes 25 to 45 minutes (`docs/plan/00-overview.md` §4 row 9). Runs are kept in this browser's `localStorage` under one key, `incident-room:cases:v1`, as JSON. With `src/lib/settings/`, this folder is the only code allowed to touch browser storage (`tests/unit/storage-guard.test.ts`).

- `schema.ts`: the `zod/mini` schema for `{ v: 1, runs: Record<caseId, CaseRunSave> }`, and `migrate(unknown)`, which turns anything (a v0 value, a hand-edited one, garbage, a newer version) into that shape without throwing. A run that doesn't validate is left out on its own. `migrateWithReport` also says which runs it left out, for the import.
- `store.ts`: `createCaseStorage({ storage })` (tests pass a fake storage) and `caseStorage`, the browser's: `load`, `save`, `remove`, `clear`, `exportText` and `importText`. Every storage call is in `try/catch`: `save` returns `false` when storage is blocked or full, and the game plays on without saving.

**What a save holds:** the workstation's log (the lines typed, Reset machine presses, and each image opened in the Evidence Browser, because opening an original with its write-blocker off changes it), pins, notes, the report draft, objectives ticked, hint tiers shown and story lines played. **Never the engine's state:** opening the case replays the log through the engine (`src/features/cases/run/`), so a save can't describe a machine the engine wouldn't make.

**Changing the shape:** bump `CASE_STORE_VERSION`, keep the old schema next to the new one, and teach `migrateWithReport` to convert it, the way v0 is converted. Add a test with a value in the old shape (`tests/components/case-storage.test.tsx`). Say what changed on `/privacy`.

Never import here: features, `src/app`, React, or the engine (`@/sim`). Pins are checked for the outline of an artefact ref only; the full check is the engine's.
