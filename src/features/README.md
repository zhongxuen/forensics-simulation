# src/features

Self-contained feature modules. Each exposes its public API through an `index.ts`; everything else in the folder is private. A feature with server-only code (anything that reads files) may also expose a `server.ts`, which client code must never import.

The features so far are `terminal` and `learning`, both vendored (`VENDORED.md`). The plan adds `cases`, `evidence-browser`, `timeline`, `case-board` and `mentor` (`docs/plan/00-overview.md` §5). Each feature has its own `README.md` saying what belongs in it.

Never import here: another feature's internals. Use `@/features/<name>`, which resolves to its `index.ts`, or `@/features/<name>/server` (ESLint enforces this). Nothing in a feature imports `src/app`.
