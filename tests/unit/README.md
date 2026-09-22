# tests/unit

Vitest unit tests, run with `pnpm test:unit` in a plain Node environment (no jsdom). The content tests here (every lesson fixture, glossary word and theme validates; the sandbox workstation builds and its commands work) are listed in `vitest.config.mts` and run as their own project, `pnpm test:content`.

The standing guarantees live here too: the storage guard (`storage-guard.test.ts`: only settings touch browser storage), `no-database.test.ts` (no database or auth library in the lockfile, no cookie code), `no-eval.test.ts` (nothing turns text into code or HTML), `security-headers.test.ts`, `contrast-audit.test.ts`, and `module-boundaries.test.ts` (the ESLint boundary rules still fire, including the `node:crypto` ban on `src/sim`).

Most files here are vendored from `../hacker-simulation`; `VENDORED.md` lists them and every change.

Never import here: a real network, database, or clock. Inject fakes instead.

`helpers/` holds shared test code (such as the storage scanner behind `storage-guard.test.ts`) and `fixtures/` holds input files that tests read. Neither is run as a test.
