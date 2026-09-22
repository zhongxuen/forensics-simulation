# tests

Tests that live outside `src`. Engine unit tests may also sit next to their code as `*.test.ts`.

The test pyramid, as Vitest projects (`vitest.config.mts`) plus Playwright:

| Layer                        | Folder                                                       | Run with                           | Environment                 |
| ---------------------------- | ------------------------------------------------------------ | ---------------------------------- | --------------------------- |
| Unit                         | `unit/`, `src/**/*.test.ts`                                  | `pnpm test:unit` (with components) | Node, no DOM                |
| Content                      | the content files in `unit/` (listed in `vitest.config.mts`) | `pnpm test:content`                | Node                        |
| Integration                  | `integration/` (none yet: the mentor routes, file 14)        | `pnpm test:integration`            | Node, Anthropic SDK mocked  |
| Components                   | `components/`                                                | `pnpm test:unit`                   | jsdom                       |
| End to end, security headers | `e2e/`                                                       | `pnpm build`, then `pnpm test:e2e` | Chromium, desktop and phone |

`pnpm test` runs every Vitest project. `pnpm test:coverage` does too, failing if coverage drops below the gates on `src/sim` and settings. The plan adds `tests/content/` for case and evidence checks (file 03).

Never import here: anything that touches a real network or service. Tests run offline.
