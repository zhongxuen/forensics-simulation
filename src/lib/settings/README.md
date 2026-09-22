# src/lib/settings

The learner's settings (md-files/03-app-state-and-privacy.md): the only thing Candlewright: Incident Room remembers between visits so far, kept in this browser's `localStorage` under one key, `incident-room:settings`, as JSON. This folder is the only code allowed to touch browser storage; `tests/unit/storage-guard.test.ts` fails if anything outside it references `localStorage`, `sessionStorage`, `indexedDB` or `document.cookie`. Mission runs, progress and anything about the learner never go in here.

- `schema.ts`: the Zod schema, written with `zod/mini` (it runs in the browser on every page, and full Zod adds ~90 KB gzipped). Each field validates on its own with a `z.catch()` default, so a corrupt or outdated value falls back without touching the others, and unknown keys are dropped.
- `store.ts`: `getSettings`, `updateSettings(changes)`, `resetSettings` and `subscribeSettings`, over `createSettingsStore` (which tests use with a fake storage). Every storage call is in `try/catch`: with storage blocked the app runs on defaults, and changes last until a reload (`updateSettings` returns `false` when it couldn't save). Changes from other tabs arrive through the `storage` event.
- `document.ts`: puts the settings that change the page's look onto `<html>`: `data-sidebar="collapsed"` (the `rail:` variant) and `data-motion` (`src/styles/motion.css`).
- `boot-script.ts`: the same thing as an inline script that runs before first paint (rendered by `SettingsBootScript` in `src/components/shell`).
- `use-settings.ts`: `useSettings()`, which re-renders on every change. Defaults on the server.

**Adding a setting** (phase 05 beginner mode, 07 graph/table view, 08 terminal theme, 10 nudge chip): add one field wrapped in `z.catch(schema, default)` to `SETTINGS_SHAPE` in `schema.ts`, read it with `useSettings()`, and change it with `updateSettings()`. Give it a one-line, plain-language row on `/settings` and a line on `/privacy`. Only if it must show before first paint, also apply it in `document.ts` and `boot-script.ts` (`tests/unit/settings-boot-script.test.ts` checks they agree). Never read storage anywhere else.

Import from `@/lib/settings` in client components. Server components that only need the boot script import `@/lib/settings/boot-script`, so they don't pull in the hook.
