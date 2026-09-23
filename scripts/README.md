# scripts

Command-line tools run with `tsx` through `package.json` scripts. Vendored from `../hacker-simulation` (`VENDORED.md`); the `case:*` scripts follow its `mission:*` ones.

Writing a case:

- `case-new.ts` — `pnpm case:new <id>`: scaffolds `src/content/cases/<id>.yaml`, its playthrough and its evidence. What it writes already validates, generates and plays to the end, with every piece of copy marked TODO, so an author starts from something that works. The template is `lib/case-template.ts`, and `tests/content/case-toolkit.test.ts` keeps that promise true.
- `case-validate.ts` — `pnpm case:validate [id…]`: the YAML and the schema, the story (it has to generate), the accepted evidence (every pattern has to match something), ids across the catalog, the lesson links, the banned words, the committed evidence, and the playthrough. `--strict` also fails on a leftover TODO, and that is what CI runs.
- `case-play.ts` — `pnpm case:play <id>`: plays a case headlessly through the same parser, engine and tool registry as the browser, and prints the transcript. With `--run "<command>"`, `--pin <pattern>`, `--report <question>=<answer>`, `--answer <objective>=<text>` and `--reset` it plays those steps instead, which is how you try something out while writing.
- `build-evidence.ts` — `pnpm evidence:build`: plays every case's story through the pure generator and writes `src/content/evidence/<case>/evidence.json` and `answers.json` with sorted keys. `pnpm evidence:check` builds without writing and fails when what is committed isn't what the stories build today, which is how a story edit nobody rebuilt gets caught in CI. What those two files hold lives in `lib/evidence-files.ts`, so every script agrees about what "up to date" means.

Checks on a production build, run after `pnpm build`:

- `bundle-size.ts` — `pnpm bundle:check`: the initial JavaScript each pre-rendered page downloads, gzipped, against the 200 KB budget and the committed baseline (`bundle-baseline.json`, reset for these routes in prompt 01.2, on 2026-09-22; a page may grow by at most 2 KB without `--update`). It also fails if a page loads the terminal, the simulation engine or the full Zod build up front.
- `check-client-bundle.ts` — `pnpm security:bundle`: every file a browser can download is scanned for secrets and server-only code (the API key's name or value, `sk-ant-` keys, the Anthropic API or SDK).

Scripts run as CommonJS under tsx, so they don't import the MDX lesson compiler, which only loads as an ES module.

Never import here: a feature's internals. Use `@/features/<name>` and `@/features/<name>/server`.
