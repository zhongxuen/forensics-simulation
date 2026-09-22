# 00 — Overview, decisions and how to run this plan

Written: 2026-09-22 (split from the single `forensics-game-plan.md`, reviewed against `../hacker-simulation` at commit `4c62fe9`)
Status: **[planned]**. Nothing is built yet.
Working title: **Candlewright: Incident Room**
Repo: `forensics-simulation` (sibling of `hacker-simulation`). Hosting: its own Vercel project. **No database** (see [../README.md](../README.md) §2).

---

## 1. Pitch

A story game where you join Candlewright Security's **blue team** after a made-up break-in at a made-up client. You get three kinds of evidence: a **disk image**, a **memory dump** and a set of **logs**. You examine them in a simulated terminal and three investigator views. You pin findings to a case board and close the case with a report that answers *who, what, when, how, and what should they fix*. Every answer has to point at evidence.

Hacker Simulation teaches how an attacker thinks, with a defender's conscience. This game teaches how a defender works out what happened. The two sites link to each other and share one world.

**Portfolio gap it fills:** `data/skills.ts` in the portfolio lists Autopsy, Volatility Workbench and FTK Imager, but no project uses them. Each view in this game copies the workflow of one of those tools, and a "Real-world equivalent" panel names the actual tool, plugin or menu path.

## 2. Project aims (what every file in this plan is checked against)

These come from Hacker Simulation's `CLAUDE.md` and `md-files/remaining.md`. This game inherits them.

1. **Beginner-first.** Assume zero knowledge. Define every term the first time it appears on a screen. A first win within **2 minutes** of landing, with no sign-up.
2. **Safe and ethical.** Blue team only. Every case has a client who asked and signed. No hacking back, even at the attacker. Nobody is targeted as a person.
3. **Accurate, and honest about limits.** A pure, deterministic engine. Evidence is generated from a written story and tested for consistency and solvability. Tool output is realistic but never copied. Disclaimers say what's left out.
4. **No dark patterns.** Hints and the mentor are free and never lower anything. No timers that gate play, no lives, no streaks, no leaderboards.
5. **Quality you can see.** axe on every route, keyboard-only play, reduced motion, 200 KB initial JS per page, Vitest + Playwright, CI on every push.
6. **Portfolio proof.** Backs up Autopsy, Volatility and FTK Imager with something a visitor can play in five minutes.

## 3. Audience and scope

- **Audience:** Hacker Simulation's complete beginners, plus students on a digital forensics course who want to practise the workflow.
- **v1:** one chapter, **three cases**, plus a sandbox evidence set with no goals.
- **Not in scope:** parsing real disk images (E01/raw) or real memory, real malware, uploads of any kind, certification prep, accounts, leaderboards.

## 4. Changes made in this review

| # | Was | Now | Why |
|---|---|---|---|
| 1 | Client "Harrowgate Logistics" | **Quillfen Freight**, a small family haulage yard, `quillfen.example`, `10.60.0.0/24` (office) and `10.60.1.0/24` (servers) | Searched 2026-09-22: a real "Harrowgate Ltd" (UK, 2025) and several "Harrow Logistics" firms exist. Hacker Simulation's world rule is that every name is searched and fictional. "Quillfen" returned no organisation. A small yard also matches the world's tone (a bakery, a theatre, a library) |
| 2 | Case 2: "an insider is suspected" | Suspicion falls on the bookkeeper and **the evidence clears them**: their account was used from another machine while they'd left | Hacker Simulation rule 4, "no targets, only clients". The investigation is of a company laptop the owner signed for, not of a person. It also teaches the most important habit: follow evidence, not suspicion |
| 3 | Evidence disk "extends the copied POSIX filesystem" | The **analyst workstation** is the vendored POSIX filesystem. Each **evidence image is its own read-only model** with Windows-style paths, MFT-like record numbers and MACB times | That is how real examiners work (a Linux forensic workstation reading a Windows image), and it keeps the vendored engine unchanged |
| 4 | Generator arrives in phase 2, after Case 1 | Evidence model and generator come **before** any case (files 02, 03) | Case 1 would otherwise need hand-written evidence, which the plan forbids |
| 5 | Hash test "computed with Node `crypto`" | A **pure-TypeScript MD5/SHA-1/SHA-256** in `src/sim/evidence/hash/`, differential-tested against `node:crypto` | `src/sim` may not import Node modules (ESLint boundary), and `hashsum` runs in the browser |
| 6 | `Tick` times | `Instant` = milliseconds since the Unix epoch, UTC, via the vendored `Clock`/`parseInstant`/`formatInstant` | Matches `hacker-simulation/src/sim/core/clock.ts`. Real forensics needs wall-clock times and time zones, and "which zone is this log in?" becomes a lesson |
| 7 | "An answer with no evidence scores zero" | Each report finding is **supported**, **needs evidence** or **not yet**. Retry freely. The debrief shows "n of m findings supported" | Keeps the rule's teaching value without a punishing score. Matches Hacker Simulation's "not quite, here's why" and its banned mechanics |
| 8 | `pin` "pins the current output line" | Every tool output line that shows an artefact carries an **artefact ref** (`disk:<image>:mft/1234`, `log:security/57`, `mem:<image>:pid/4120`). Pins store refs, and the grader checks refs | Without refs the grader can't tell which evidence a pin points at |
| 9 | Progress in `localStorage` "as Hacker Simulation already does" | Hacker Simulation stores **settings only**, and its standing decision is "no saved progress". This game **deliberately diverges**: case runs (board, notes, report draft) are saved in this browser, because a case takes 25–45 minutes | Called out so it's a decision, not an accident. `/privacy` says exactly what's stored, with a "Clear everything" button |
| 10 | Zustand in the default stack | A pure `caseRunReducer` held by a hook, like Hacker Simulation's `missionRunReducer`. Add Zustand only if cross-pane state gets painful | One less dependency, and the vendored terminal and runner already use this pattern |
| 11 | `content/` at the repo root | `src/content/cases/`, `src/content/evidence/`, `src/content/lessons/` | Matches Hacker Simulation, whose content boundary rules and loaders get vendored |
| 12 | Evidence JSON committed, loading unspecified | Evidence is loaded with a dynamic `import()` per case, so it's never in a page's first download. `bundle:check` enforces it | The 200 KB budget |
| 13 | Lessons written from scratch | Link to Hacker Simulation's level 1–2 lessons (`forensics-what-logs-are`, `forensics-timelines`, `forensics-evidence-care`, `blue-incident-response`) as prerequisites, and write deeper ones here | Don't duplicate content that already exists and is tested |
| 14 | Case 3 has no choice beats | Two beats: "pull the plug or capture memory first?" (order of volatility) and Kit wanting to connect to the attacker's address (no hacking back) | Hacker Simulation's rule 6: temptation shows consequences, not punishment |
| 15 | Case 1 has no wrong turn | Opening the laptop's disk **without** the write-blocker changes access times, so the hash no longer matches the handover form. Reset is one click | The single best way to teach why write-blocking and hashing matter |
| 16 | "v1 has one Windows-like and one Linux-like machine" | Evidence machines are Windows-like. The analyst workstation is Linux-like | Simpler, and it's the real-world setup |
| 17 | Portfolio README's `localStorage` note and default stack | Corrected in [../README.md](../README.md) | Accuracy |

## 5. Architecture in one picture

```
src/sim/            pure engine, vendored core + fs + shell + tools (no React, no I/O, no Date.now)
  evidence/         NEW: disk, memory, logs types; image bytes; pure hashes; artefact refs
  tools/forensics/  NEW: acquire, hashsum, lsfs, inode, recover, carve, strings, mem, logq, timeline, pin
src/content/
  cases/*.yaml      ground-truth story + briefing, objectives, hints, report questions
  evidence/<case>/  generated JSON (committed, checked for staleness)
  lessons/*.mdx
scripts/build-evidence.ts   story → evidence (Node, runs the pure generator)
src/features/
  terminal/ mentor/ learning/          vendored
  cases/            NEW: loader, caseRunReducer, grading, chain of custody
  evidence-browser/ timeline/ case-board/   NEW views
```

## 6. How to run this plan

Each numbered file is one unit of work with a **Goal**, **Depends on**, **Spec**, one or more **Prompts** to paste into a fresh Claude Code session opened in this repo, and **Done when**. [99-reference.md](99-reference.md) holds the story world, voice rules, tool table, risks and sources that every prompt points to.

### Waves

Files in the same wave don't depend on each other. Run them **at the same time**, each in its own git worktree or branch (`claude --worktree`, or the Agent tool with `isolation: "worktree"`), then merge in the order listed. Wait for a wave to be merged and green before starting the next.

| Wave | Files | Mode | Estimate |
|---|---|---|---|
| 0 | [01 Foundation](01-foundation.md) | alone | 2–3 days |
| 1 | [02 Evidence model](02-evidence-model.md) | alone | 3–4 days |
| 2 | [03 Case format + generator](03-case-format-and-generator.md) ‖ [04 Disk tools](04-disk-tools.md) ‖ [05 Workspace UI](05-workspace-ui.md) ‖ [13 Learning Center](13-learning-center.md) | parallel, merge 03 → 04 → 05 → 13 | 1–1.5 weeks |
| 3 | [06 Case 1](06-case-1-the-clean-copy.md) | alone. **Milestone: Case 1 playable.** Optional: run [15](15-quality-and-launch.md) part A to ship "Case 1 only" | 3–5 days |
| 4 | [07 Carve, strings, logq](07-carve-strings-logq.md) ‖ [08 Memory tools](08-memory-tools.md) ‖ [09 Timeline](09-timeline.md) ‖ [10 Case board, report, custody](10-case-board-report-custody.md) | parallel, merge 07 → 08 → 09 → 10 | 1.5–2 weeks |
| 5 | [11 Case 2](11-case-2-the-deleted-invoice.md) ‖ [12 Case 3](12-case-3-something-is-still-running.md) ‖ [14 Mentor](14-mentor.md) | parallel | 1.5–2 weeks |
| 6 | [15 Quality and launch](15-quality-and-launch.md) | alone | 1 week |
| 7 | [16 Portfolio entry](16-portfolio-entry.md) | alone, in the portfolio repo | half a day |

```
W0  01
W1  02
W2  03 ‖ 04 ‖ 05 ‖ 13
W3  06                      ← Case 1 playable (optional early deploy: 15 part A)
W4  07 ‖ 08 ‖ 09 ‖ 10
W5  11 ‖ 12 ‖ 14
W6  15
W7  16                      ← in ../zhongxuen-portfolio
```

Hard dependencies, if you want to reorder: 03, 04 and 05 need 02. 06 needs 03, 04 and 05. 07, 08 and 09 need 02 (and 03 for fixtures). 10 needs 05. 11 needs 06, 07, 09 and 10. 12 needs 06, 08, 09 and 10. 13 needs only 01. 14 needs 06 and 10.

### Rules for parallel prompts

- Each prompt lists the files and folders it **owns**. It only creates or edits those, plus **one line each** in the shared registration points: `src/sim/tools/forensics/index.ts` (tool registry), `src/features/cases/workspace-panes.ts` (pane registry), and `src/content/cases/schema.ts` only where the prompt says so.
- Every prompt ends with `pnpm lint && pnpm typecheck && pnpm test` green and one commit (or a small series) on its branch.
- If two branches conflict on a registration line, keep both lines.

### The preamble every prompt assumes

Each prompt below starts with this line, so it works in a fresh session:

> Read `CLAUDE.md`, `docs/plan/00-overview.md`, `docs/plan/99-reference.md` and the plan file named below before writing code. Read the relevant guide in `node_modules/next/dist/docs/` before touching Next.js APIs. The sibling repo `../hacker-simulation` is the source for anything marked "vendored". Read it and don't modify it.

## 7. Where things are stored (no database)

| Data | Where |
|---|---|
| Cases, stories, lessons, glossary | Repo: `src/content/cases/*.yaml`, `src/content/lessons/*.mdx`, `src/content/glossary.ts` |
| Generated evidence | Repo: `src/content/evidence/<case>/*.json`, built by `pnpm evidence:build`, committed, checked for staleness in CI |
| Settings | `localStorage` key `incident-room:settings` (vendored settings module) |
| Case runs: board, notes, report draft, custody log | `localStorage` key `incident-room:cases:v1`, Zod-parsed on load, with a migration function. Safe when storage is blocked: the game still plays, it doesn't save |
| Moving progress between devices | "Export my cases" → JSON file. "Import" reads it back, validated |
| Mentor | Optional `/api/mentor/*` routes calling the Claude API (`claude-haiku-4-5` by default, `MENTOR_MODEL` to override). Without a key, hints are the authored text |
| Usage counts | `@vercel/analytics`, same rules as Hacker Simulation (cookieless, Do Not Track honoured) |

Firebase isn't needed. A leaderboard is out of scope for good: it's a banned mechanic.
