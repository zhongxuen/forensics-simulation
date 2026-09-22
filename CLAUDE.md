# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

**Start with `docs/plan/00-overview.md`.** It holds the decisions, the waves and how to run each plan file's prompts. `docs/plan/99-reference.md` holds the story world, voice rules, tool table and risks that every prompt points to.

## Project status

Plan file 01 (foundation) is built: a Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS 4 app, managed with pnpm 11, with Hacker Simulation's pure engine, terminal, settings, UI kit, app shell, lesson pipeline and quality scripts vendored from `../hacker-simulation` at commit `4c62fe9` (`VENDORED.md` lists every copied path and every change since). Routes: `/` (one line and "Open Case 1"), `/cases` and `/cases/[slug]` (placeholders for `case-01` to `case-03`), `/sandbox` (the vendored terminal on the analyst workstation `ir-ws-01`, account `examiner`, from `src/content/sandbox/workstation.ts`), `/learn` (placeholder), `/settings` (the vendored settings form, key `incident-room:settings`), `/privacy`, and `/styleguide` (dev only). Nothing forensics-specific exists yet: the evidence model is file 02, the case format and generator file 03.

Prompt 01.2 (CI adapted from the sibling, bundle baseline reset) is next. `.github/workflows/ci.yml` is still the sibling's copy until then.

## What this project is

Candlewright: Incident Room is a story game where the player joins Candlewright Security's blue team after a made-up break-in at a made-up client (Quillfen Freight). They examine a disk image, a memory dump and a set of logs in a simulated terminal and three investigator views, pin findings to a case board, and close the case with a report where every answer points at evidence. It shares a world, cast and engine with Hacker Simulation, and fills the portfolio's Autopsy, Volatility and FTK Imager gap.

## Aims (docs/plan/00-overview.md §2)

1. **Beginner-first.** Assume zero knowledge. Define every term the first time it appears on a screen. A first win within 2 minutes of landing, with no sign-up.
2. **Safe and ethical.** Blue team only. Every case has a client who asked and signed. No hacking back, even at the attacker. Nobody is targeted as a person.
3. **Accurate, and honest about limits.** A pure, deterministic engine. Evidence is generated from a written story and tested for consistency and solvability. Tool output is realistic but never copied.
4. **No dark patterns.** Hints and the mentor are free and never lower anything. No timers that gate play, no lives, no streaks, no leaderboards.
5. **Quality you can see.** axe on every route, keyboard-only play, reduced motion, 200 KB initial JS per page, Vitest + Playwright, CI on every push.
6. **Portfolio proof.** Something a visitor can play in five minutes.

The quick test for any screen: _would a complete beginner understand this and want to keep going?_ Voice rules and banned words are in `docs/plan/99-reference.md`.

## Commands

Use pnpm (pinned via `packageManager` in `package.json`).

- `pnpm install` — install dependencies
- `pnpm dev` — dev server at http://localhost:3000
- `pnpm build` — production build; also type-checks. `pnpm start` serves it
- `pnpm lint` — ESLint, including the module-boundary rules
- `pnpm typecheck` — `next typegen`, then `tsc --noEmit` (plain `tsc` fails without typegen: `LayoutProps`/`PageProps` are generated globals)
- `pnpm test` — every Vitest project once; `pnpm test:watch` to watch
- `pnpm test:unit` (unit + jsdom components), `pnpm test:content`, `pnpm test:integration` (none yet), `pnpm test:coverage` (fails below the gates in `vitest.config.mts`)
- `pnpm test tests/unit/environment.test.ts` — one file (add `-t "<name>"` to filter by test name)
- `pnpm test:e2e` — Playwright against a production build: `pnpm build` first; the config starts `pnpm start` on port 3217. `pnpm exec playwright install chromium` once
- `pnpm bundle:check` — after a build: initial JS per page against the 200 KB budget and `scripts/bundle-baseline.json` (`--update` to accept an increase on purpose)
- `pnpm security:bundle` — after a build: fails if a secret, server-only env var name or the Anthropic SDK reached a browser file
- `pnpm format` / `pnpm format:check` — Prettier (with Tailwind class sorting)

## Tech stack

Next.js 16.3 (App Router), React 19.3, TypeScript 6 (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`), Tailwind CSS 4 (CSS-first, `src/styles/`), Zod 4 (`zod/mini` in browser code), `yaml`, `@mdx-js/mdx` + `remark-gfm` + Shiki for lessons, Vitest 5 projects (unit, content, integration, components/jsdom), Playwright + `@axe-core/playwright`, `tsx`, Prettier with the Tailwind plugin, `@vercel/analytics` and `@vercel/speed-insights` (loaded lazily, only on Vercel, never under Do Not Track or with the `usageCounts` setting off). No Zustand: case state will be a pure reducer held by a hook (00 §4 row 10). No database, accounts or cookies (`tests/unit/no-database.test.ts`).

## Architecture

Every top-level folder under `src/` and `tests/` has a short `README.md` saying what belongs there and what it must never import. See `docs/plan/00-overview.md` §5 for where the plan puts new code.

- `src/app/` — routes only, kept thin. `(marketing)/` public pages (`/`, `/privacy`) with a footer, `(app)/` the product inside the app shell, `(dev)/` developer-only pages (a 404 in production), `search-index.json/` the build-time search index for the command palette. Every route has an error and a not-found state (`not-found.tsx`, `(app)/error.tsx`, `(marketing)/error.tsx`, `global-error.tsx`, all using `ErrorState`). `/sandbox` loads its terminal through `lazy-sandbox-workspace.tsx`, so the engine isn't in the first download.
- `src/sim/` — the pure, headless, deterministic engine (vendored): `core/`, `fs/`, `net/`, `shell/`, `tools/`. The only entry point is `step(state, cmd, ctx)`; import from `@/sim` or `@/sim/types`. Adding a tool is one file plus one line in `src/sim/tools/index.ts`. The plan adds `src/sim/evidence/` and `src/sim/tools/forensics/`; the purity rules cover them automatically. Golden snapshots live in `src/sim/__fixtures__/golden/`: after an intentional output change, delete them, rerun `pnpm test`, and review the diff.
- `src/content/` — declarative data validated by Zod schemas: the sandbox workstation, the cast (`cast.ts`, speaker ids fixed), glossary, topics, terminal themes, and the banned-word list (`voice.ts`). Cases, evidence and lessons arrive in files 03, 06 and 13.
- `src/features/<name>/` — self-contained modules with a public `index.ts` and optionally a server-only `server.ts`: `terminal` (parser, `useTerminalSession`, `Terminal`, beginner mode) and `learning` (lesson loader and renderer, `<Term>`, `<Quiz>`, `<MiniTerminal>`, search index).
- `src/components/` (`ui/` primitives on semantic tokens, `shell/` the app shell and command palette, `settings/` the `/settings` form), `src/lib/` (section list, "Start here" target, search, security headers, analytics, and `settings/`, the only code allowed to touch browser storage), `src/hooks/`, `src/styles/`.
- `tests/unit/`, `tests/components/` (jsdom), `tests/e2e/` (Playwright against a production build). `scripts/` holds `bundle-size.ts` and `check-client-bundle.ts`.

### Enforced import boundaries

Rules 1–4 are ESLint errors (`eslint.config.mjs`), and `tests/unit/module-boundaries.test.ts` proves they still fire:

1. `src/sim/**` may only import from `src/sim`. No `react`, `react-dom`, `next`, Node modules (`node:*`, `fs`, `net`, …) or `crypto` / `node:crypto` (use the pure hashes in `src/sim/evidence/hash/`, file 02), and no browser globals (`fetch`, `window`, `localStorage`, `crypto`, …).
2. `src/sim/**` must stay deterministic: no `Math.random()`, `Date.now()`, `performance.now()`, or argument-less `new Date()`. Inject a seeded RNG and a clock.
3. `src/content/**` may only import from `@/content` and `@/sim/types`.
4. Code outside a feature imports it only through `@/features/<name>` or `@/features/<name>/server`.
5. Only `src/lib/settings/**` may reference `localStorage`, `sessionStorage`, `indexedDB` or `document.cookie` (`tests/unit/storage-guard.test.ts`). File 05 adds `src/lib/case-storage/` for saved case runs, a deliberate divergence from Hacker Simulation (00 §4 row 9).

TypeScript `any` is a lint error.

### Browser bundle rules

- Every page's initial JS stays under 200 KB gzipped, and may not grow more than 2 KB over `scripts/bundle-baseline.json` without `--update` and a reason.
- Browser code never imports full `zod`: use `zod/mini`, or keep the schema server-side.
- The terminal and the engine load on demand (`React.lazy`); evidence JSON loads with a dynamic `import()` per case (00 §4 row 12).
- `package.json` declares `"sideEffects": ["*.css"]`. Never write a module that must run for its side effects alone.

## Working conventions

- Vendored code: read `VENDORED.md` before changing a vendored file, and update its row after. Never modify `../hacker-simulation`.
- Implement one plan file at a time; a prompt owns only the files it lists, plus one line each in the shared registration points (00 §6).
- Keep the story fictional: only cast characters and world-fact places, `.example` domains, RFC 5737 and private address ranges. Search every new name before using it.
- Never modify files unrelated to the current task.
