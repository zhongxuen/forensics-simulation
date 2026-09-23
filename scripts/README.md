# scripts

Command-line tools run with `tsx` through `package.json` scripts. Vendored from `../hacker-simulation` (`VENDORED.md`); the plan adds the `case:*` scripts in prompt 03.2.

- `build-evidence.ts` — `pnpm evidence:build`: plays every case's story through the pure generator and writes `src/content/evidence/<case>/evidence.json` and `answers.json` with sorted keys. `pnpm evidence:check` builds without writing and fails when what is committed isn't what the stories build today, which is how a story edit nobody rebuilt gets caught in CI.

Checks on a production build, run after `pnpm build`:

- `bundle-size.ts` — `pnpm bundle:check`: the initial JavaScript each pre-rendered page downloads, gzipped, against the 200 KB budget and the committed baseline (`bundle-baseline.json`, reset for these routes in prompt 01.2, on 2026-09-22; a page may grow by at most 2 KB without `--update`). It also fails if a page loads the terminal, the simulation engine or the full Zod build up front.
- `check-client-bundle.ts` — `pnpm security:bundle`: every file a browser can download is scanned for secrets and server-only code (the API key's name or value, `sk-ant-` keys, the Anthropic API or SDK).

Scripts run as CommonJS under tsx, so they don't import the MDX lesson compiler, which only loads as an ES module.

Never import here: a feature's internals. Use `@/features/<name>` and `@/features/<name>/server`.
