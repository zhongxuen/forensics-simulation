# tests

Tests that live outside `src`. Engine unit tests may also sit next to their code as `*.test.ts`.

The test pyramid, as Vitest projects (`vitest.config.mts`) plus Playwright:

| Layer                        | Folder                                                                        | Run with                           | Environment                 |
| ---------------------------- | ----------------------------------------------------------------------------- | ---------------------------------- | --------------------------- |
| Unit                         | `unit/`, `src/**/*.test.ts`                                                   | `pnpm test:unit` (with components) | Node, no DOM                |
| Content                      | `content/`, plus the content files in `unit/` (listed in `vitest.config.mts`) | `pnpm test:content`                | Node                        |
| Integration                  | `integration/` (none yet: the mentor routes, file 14)                         | `pnpm test:integration`            | Node, Anthropic SDK mocked  |
| Components                   | `components/`                                                                 | `pnpm test:unit`                   | jsdom                       |
| End to end, security headers | `e2e/`                                                                        | `pnpm build`, then `pnpm test:e2e` | Chromium, desktop and phone |

`pnpm test` runs every Vitest project. `pnpm test:coverage` does too, failing if coverage drops below the gates on `src/sim` and settings.

`content/` holds the seven groups that keep a case honest (`docs/plan/03-case-format-and-generator.md` §Tests), one file each: `case-schema` (every case parses, with messages an author can act on), `case-consistency` (the evidence agrees with the story that made it), `case-evidence` (staleness and determinism), `case-solvability` (each case's playthrough still finishes it), `case-answers` (answer integrity), `case-world` (reserved addresses, made-up names, the cast, the banned words) and `case-toolkit` (what `pnpm case:new` writes still works). `support.ts` holds the three checks they share, written to return problems rather than assert, so `case-failure-modes` can move a story action an hour and read back the message an author would see — a check nobody has watched fail is a check nobody knows works.

Never import here: anything that touches a real network or service. Tests run offline.
