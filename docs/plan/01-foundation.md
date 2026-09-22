# 01 — Foundation: scaffold, vendored engine, boundaries, CI

**Wave 0 · alone · 2–3 days**
**Depends on:** nothing
**Owns:** the whole repo (it's empty)

## Goal

A Next.js app with the same stack, folder rules and quality checks as Hacker Simulation, with its pure engine, terminal, settings, UI kit, lesson pipeline and quality scripts copied in and still passing their own tests. Nothing forensics-specific yet.

## Spec

### Stack (match `../hacker-simulation/package.json`)

Next.js 16.3 (App Router), React 19.3, TypeScript 6 strict (`noUncheckedIndexedAccess`, `noImplicitOverride`), Tailwind CSS 4 (CSS-first), Zod 4 (`zod/mini` in browser code), `yaml`, `@mdx-js/mdx` + `remark-gfm` + Shiki, Vitest 5 projects (unit, content, integration, components/jsdom), Playwright + `@axe-core/playwright`, `tsx`, Prettier with the Tailwind plugin, pnpm 11 pinned in `packageManager`. `@vercel/analytics` and `@vercel/speed-insights`, loaded the same way. No Zustand (see 00 §4 row 10).

### What to vendor

Copy into the **same paths** as the source, so their imports, tests and READMEs still make sense. Record each in `VENDORED.md` with source path, commit (`git -C ../hacker-simulation rev-parse HEAD`), date, and "changed since copy: no/yes (what)".

| From `../hacker-simulation/` | Keep for |
|---|---|
| `src/sim/core/`, `src/sim/fs/`, `src/sim/shell/`, `src/sim/types.ts`, `src/sim/index.ts` | Engine loop, analyst workstation filesystem, shell |
| `src/sim/tools/` framework: `args.ts`, `catalog.ts`, `help.ts`, `registry.ts`, `types.ts`, `index.ts`, `commands/` (the Linux command set) | Tool framework + `ls`, `cat`, `grep`, `cd` … on the workstation. **Drop** `netscan`, `webprobe`, `hashid` and `src/sim/net/` unless a test needs them. Keep `logview` only if it helps `logq` in 07 |
| `src/features/terminal/` | Terminal UI, parser, beginner mode, a11y |
| `src/features/learning/` + lesson components | Lesson pipeline, `<Quiz>`, `<MiniTerminal>`, `<Term>`, glossary, search |
| `src/components/ui/`, `src/components/shell/`, `src/styles/` | Design tokens, primitives, app shell, SIMULATED marker, command palette |
| `src/lib/settings/`, `src/lib/security-headers.ts`, `src/lib/contrast*.ts`, `src/lib/analytics/`, `src/lib/cx.ts` | Settings, CSP, contrast audit, cookieless analytics |
| `src/content/voice.ts` and its test, `src/content/schemas/` pieces the lesson loader needs | Banned-word check |
| `scripts/bundle-size.ts`, `scripts/check-client-bundle.ts`, `scripts/lib/` | `bundle:check`, `security:bundle` |
| `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `tsconfig.json`, `next.config.ts`, `vercel.json`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.prettierrc*` | Same rules and CI. Remove the `mission:*` scripts for now; 03 adds `case:*` |
| `tests/unit/no-database.test.ts`, contrast-audit test, security-header e2e | Standing guarantees |

**Don't vendor yet:** `src/features/mentor/` (file 14), `src/features/missions/` (file 03 takes pieces), `src/features/network-visualizer/`.

Rename user-visible branding to "Candlewright: Incident Room" and the storage key to `incident-room:settings`. Keep Hacker Simulation's cast file `src/content/cast.ts` as-is: same speaker ids.

### Boundaries

Keep Hacker Simulation's ESLint zones (sim is pure, content is data, features are private behind `index.ts`/`server.ts`). Add: `src/sim/evidence` and `src/sim/tools/forensics` fall under the `src/sim` purity rules automatically. Add a lint test that fails if any file under `src/sim` imports `node:crypto`.

### Pages (placeholders)

`/` landing (one line + "Open Case 1" button), `/cases`, `/cases/[slug]`, `/sandbox`, `/learn`, `/settings`, `/privacy`, `/styleguide` (dev only). Every route has error and not-found states from the vendored shell.

### Repo files

`CLAUDE.md` (adapted from Hacker Simulation's: project status, aims from 00 §2, commands, architecture, "Start with `docs/plan/00-overview.md`"), `AGENTS.md` (the Next.js block), `README.md` (pitch, status, link to the plan), `VENDORED.md`, `.env.example` (`ANTHROPIC_API_KEY=`, `MENTOR_DISABLED=`, `MENTOR_MODEL=`).

## Prompt 01.1 — scaffold and vendor

```text
Read CLAUDE.md if it exists, docs/plan/00-overview.md, docs/plan/99-reference.md and
docs/plan/01-foundation.md. The sibling repo ../hacker-simulation is the source for everything
marked "vendored": read it, never modify it.

Build file 01 of the plan:
1. Scaffold the Next.js app with exactly the stack in 01 §Stack, matching the dependency versions in
   ../hacker-simulation/package.json. Read node_modules/next/dist/docs/ for anything Next-specific.
2. Copy the folders and files in the "What to vendor" table into the same paths. Fix imports only
   where a dropped module (net, netscan, webprobe, hashid, missions) was used; note every change in
   VENDORED.md with the source commit hash.
3. Keep the ESLint boundary zones and sim purity rules unchanged. Add the node:crypto ban for src/sim.
4. Add the placeholder routes from 01 §Pages inside the vendored app shell, with branding
   "Candlewright: Incident Room" and the settings key incident-room:settings.
5. Write CLAUDE.md, AGENTS.md, README.md, VENDORED.md and .env.example as described in 01 §Repo files.
   Every top-level folder under src/ and tests/ keeps or gets a short README.md saying what belongs
   there and what it must never import.
6. Make the vendored tests pass here. Delete tests only for modules you dropped, and list them in
   VENDORED.md.

Stop and ask me if a vendored module pulls in something that isn't in the table.
Finish with pnpm lint, pnpm typecheck, pnpm test and pnpm build all green, then commit.
```

## Prompt 01.2 — CI and deployment wiring

Run right after 01.1 in the same session, or in a new one.

```text
Read docs/plan/00-overview.md and docs/plan/01-foundation.md.
1. Adapt .github/workflows/ci.yml from ../hacker-simulation: lint, typecheck, format:check,
   pnpm audit --audit-level high, the Vitest projects, coverage gates on src/sim, and a build job that
   runs bundle:check, security:bundle and the Playwright suite (axe on every route, security headers).
   Leave placeholders (commented, with a TODO naming the plan file) for evidence:check (file 03) and
   case:validate (file 03).
2. Reset scripts/bundle-baseline.json for the new routes.
3. Add .github/dependabot.yml as in the sibling repo.
4. vercel.json pins "framework": "nextjs".
Don't create the Vercel project. That's an owner step in file 15.
Finish with everything green locally, then commit.
```

## Done when

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm bundle:check`, `pnpm security:bundle`, `pnpm test:e2e` all pass
- [ ] `/sandbox` placeholder shows the vendored terminal on a tiny workstation machine, and `ls`, `cat`, `grep` work
- [ ] `VENDORED.md` lists every copied path with the source commit
- [ ] Importing `react` or `node:crypto` from `src/sim` fails lint
