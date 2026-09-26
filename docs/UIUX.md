# UIUX — critique, theme and improvement plan

Written: 2026-09-24, against `learning-13.2` (`d30d164`), after reading every file in `docs/plan/` and walking the production build at 1440 × 900: `/`, `/cases`, `/cases/case-01` (briefing, workspace, Evidence, Timeline, Objectives), `/learn`, a lesson and `/sandbox`.
Status: **every prompt from UX.1 to UX.8 has merged** (UX.9 is optional and not started). §2's items are ticked ✓ with the prompt that did each; what's left is in §2.9, "Still open". UX.8 (2026-09-26) added `tests/e2e/visual.spec.ts` (screenshot baselines) and `tests/e2e/viewport.spec.ts`, and the UI review checklist in `docs/runbook.md` §9.

This file follows the plan's house rules: every prompt names what it **owns**, starts with the preamble in `docs/plan/00-overview.md` §6, and ends with `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green and one commit. Voice rules, banned words and the six world rules are in `docs/plan/99-reference.md`, and they win over anything here.

---

## 1. What the UI has to do

These are the project's aims (00 §2), turned into UI tests:

| Aim                                    | What it means on screen                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Beginner-first, first win in 2 minutes | Every screen answers **"what do I do now?"** before anything else. One main action per screen. The current objective is always in view |
| Safe and ethical                       | Scope and permission look like documents you were handed, not like fine print                                                          |
| Honest about limits                    | SIMULATED is always visible, but **once per view**, not three times                                                                    |
| No dark patterns                       | Celebrations reward, they never pressure. No red countdowns, no numbers that go down                                                   |
| Quality you can see                    | AA contrast everywhere, keyboard-first, reduced motion, 200 KB per page                                                                |
| Portfolio proof                        | A visitor gets the idea from one screenshot of the workspace                                                                           |

The quick test from `CLAUDE.md` still applies to every screen: _would a complete beginner understand this and want to keep going?_

## 2. Critique of the current UI

Severity: **P1** stops or confuses a beginner, **P2** slows them down or weakens hierarchy, **P3** polish. ✓ marks an item that is done, checked in UX.8 against the build and the visual baselines.

### 2.1 Across the whole site

| #   | Sev | What's wrong                                                                                                                                                      | Why it matters                                                                                     | Fix (prompt)                                                                                           | Done         |
| --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------ |
| G1  | P2  | The site uses Hacker Simulation's look unchanged: cyan accent, violet reward, the `>▌` terminal logo                                                              | The blue team's game looks like the red team's. Nothing says "evidence room" or "Candlewright"     | The Lamplight theme, §3 (**applied**), logo mark in UX.1                                               | ✓ UX.1       |
| G2  | P1  | The sidebar's **Start here** card is the loudest thing on every page, a solid accent slab, even while you're already playing Case 1                               | It competes with each page's own main button, and inside a case it points at where you already are | UX.2: make it context-aware ("Continue Case 1 · 1 of 5", or hidden on the case's own page) and quieter | ✓ UX.2       |
| G3  | P2  | SIMULATED shows **three times** in the workspace (top bar, case header, terminal header) and **twice** on the landing page (badge plus "SIMULATED: every piece…") | Repetition turns a trust signal into noise, and it pushes the title aside                          | Once per view: the shell's top bar plus any embedded terminal (lessons need it). UX.1 and UX.2         | ✓ UX.1, UX.2 |
| G4  | P2  | The top bar repeats the section name ("Cases") that the sidebar already highlights, and the page's H1 says it again                                               | Three labels for one fact, and still no way back up from a case                                    | Replace it with a breadcrumb: `Cases / The clean copy`. UX.2                                           | ✓ UX.2       |
| G5  | P2  | Section labels, status text and help text all sit at `text-sm` in similar greys                                                                                   | Hierarchy is flat inside panes: the eye can't tell a heading from a hint                           | A type scale with named roles (§4.2). UX.1                                                             | ✓ UX.1       |
| G6  | P3  | Success lines use the reward violet as **body text** (the objective's success sentence)                                                                           | Long violet text is tiring to read, and it spends the reward colour on text instead of the moment  | Reward colour on the tick and a left rule, sentence in `text-primary`. UX.1 (`ObjectiveTick`)          | ✓ UX.1       |
| G7  | P2  | Destructive actions are at eye level: **Start the case again** is a red button beside the case title, and **Reset machine** sits next to **Copy transcript**      | A beginner reads red-and-prominent as "important, press me". It sits where the next step should be | Move them into a "⋯ Case" overflow menu; keep the confirm dialog. UX.3, UX.4                           | ✓ UX.3, UX.4 |

### 2.2 Landing page (`/`)

- ✓ (UX.2) **P2** It's a single text column with no picture of the game. A visitor can't see what "a simulated terminal and three investigator views" looks like before committing. Add one visual: a still (or lightly animated) strip of the loop _evidence bag → terminal → board → report_, which is also the portfolio screenshot.
- ✓ (UX.2) **P2** "What this is, and isn't" is as loud as the pitch. Keep it, but in a quieter block below "What you'll do in Case 1" (three short steps: _check the paperwork · make a copy you can prove · find the note_).
- ✓ (UX.2) **P3** No way to Learn or Sandbox from `/` without playing. Add a small top bar (brand, Learn, Sandbox) without adding a second main button.
- ✓ (UX.2) **P3** The title wraps as "Candlewright: Incident / Room" at desktop width. Two lines on purpose ("Candlewright" small eyebrow, "Incident Room" as the H1) reads better.

### 2.3 Case list (`/cases`)

- ✓ (UX.2) **P1** Cards show only a title and a summary. No case number, time, **state** (not started, in progress 2 of 5, closed with 3 of 3 supported) or button. A returning player can't see where they left off.
- ✓ (UX.2) **P2** "Practice: the first morning" sits beside Case 1 as an equal, with nothing saying it's practice or which to play first. Give practice its own labelled row, after the chapter's cases, or mark Case 1 "Start here".
- ✓ (UX.2) **P3** The chapter intro is good copy but reads as two paragraphs of equal weight. Make the first a lede and the second a short "How a case works" list with icons (disk, memory, logs → board → report).

### 2.4 Case briefing

Good bones: cold-open lines, the first objective callout, written permission. Problems:

- ✓ (UX.3) **P1** At 1440 × 900 the **Start case** button is below the fold, after the situation and the permission. A beginner who reads the first screen doesn't see how to begin. Add a sticky action bar (Start case, "About 15 minutes", "Hints are free").
- ✓ (UX.3) **P2** "Your written permission" is a blue callout like any other. It's the most important ethical beat of the case: style it as a **letter** (paper-toned card, "Signed: …", scope as a short list with ✓ may examine / ✕ out of scope).
- ✓ (UX.3) **P3** Section headings ("The situation") are small grey labels; the situation paragraph looks like body text of the chat above it.

### 2.5 Case workspace (the screen a player spends 15–45 minutes in)

- ✓ (UX.3; held by `viewport.spec.ts`) **P1 The page scrolls, not the panes.** After a few commands and a team message, the terminal and its prompt scroll off the top while you read objectives, and the terminal's **Try:** chips start below the fold. The workspace should fill the viewport (`100dvh` minus the header), with the terminal and the pane each scrolling on their own.
- ✓ (UX.3) **P1 There is no "now".** The Objectives pane lists all five objectives with their **Why** text and a **Show a hint** button each, open all at once. The one that matters is not marked. Show the current objective expanded, later ones as titles only, done ones collapsed with their tick.
- ✓ (UX.3) **P1 The team chat pushes the checklist down.** Every new message goes above the objectives, so the progress bar moves further away as the story goes on. Show the newest message as a callout under the current objective ("Noor: …", with "2 earlier messages"), and keep the full chat in a collapsible section.
- ✓ (UX.3, UX.5) **P2 The Evidence Browser and Timeline are squeezed into half the width.** The browser stacks tree, filters and records vertically in a 540 px column; the filter form (with two raw date inputs) shows before any drive is open. Add a split handle (drag and keyboard) and a **Focus pane** toggle that gives a pane the full width, with the terminal as a drawer.
- ✓ (UX.3) **P2 Tab order fights the default.** The workspace opens on Objectives, which is the **last** tab. Order: _Objectives · Evidence · Timeline · Board_. Add small counts (Board 3) and a dot when a tab has something new (a pin landed, a message arrived).
- ✓ (UX.3) **P2** The tab strip shows a stray vertical scroll arrow at its right end (`overflow-x-auto` on a row that doesn't overflow); use `overflow-x-auto` only below `lg`, or hide the scrollbar.
- ✓ (UX.2) **P2** The sidebar keeps its full 315 px width inside a case, taking a fifth of the screen from the workspace. Collapse to the icon rail while a case runs (the rail already exists), and restore when you leave.
- ✓ (UX.3) **P3** "Case · 1 of 5 objectives done" above the title repeats the progress bar in the pane. Use the header for a compact progress ring and the case number.
- ✓ (UX.5: didn't reproduce; `timeline-performance.spec.ts` traces Timeline ⇄ Board and finds no long task) **Seen once, not confirmed:** while switching Timeline → Board with a few commands in the log, the tab stopped answering screenshot requests. It may be the browser tool, not the app. UX.5 re-checks it with the Playwright timeline spec and the performance trace.

### 2.6 Terminal

- ✓ (UX.4) **P2** The **Try:** chips don't follow the case: after `cat handover.txt` ticks, it still suggests `cat handover.txt` and `cd export`. They should come from the current objective (tier-0 suggestions, never the hint's answer) or, with beginner mode off, disappear.
- ✓ (UX.4) **P2** "What just happened?" floats at the right of the command line and forces the command itself to wrap (`blocker` / `status` on two lines). Put it at the end of the output block, or reveal it on hover and focus.
- ✓ (UX.4) **P3** Long hashes wrap at the container edge and split mid-value. Keep hex values on their own line with `break-all` and a copy button, which also helps with comparing against the form.
- ✓ (UX.4) **P3** Output blocks run together. A little space (8 px) and a faint left rule per command make "what did this command print" easy to see.

### 2.7 Report and debrief (read from code; not reached in the browser)

- ✓ (UX.6) **P2** The report is one long form of fieldsets and native `<select>`s. Show the questions as a numbered list with a progress line ("2 of 3 answered, 1 with evidence"), and the Supporting evidence picker as pin cards with their source badge, not a dropdown.
- ✓ (UX.6) **P1** On the debrief, the outcome that matters, "**n of m findings supported**", comes after the objectives list. Lead with it, as the moment of the case (a "Case closed" stamp, §5).
- ✓ (UX.6) **P2** The debrief ends with three buttons side by side, one of them red (Start the case again). Main: **Next case** (or "Back to your cases" while Case 2 is unreleased); secondary: Back to the workspace; restart in the overflow menu.

### 2.8 Learning Center, sandbox, settings

- ✓ (UX.7) **Learn** is the strongest part of the UI: clear H1, numbered lesson cards with level and time, a lesson page with "Best read first", an "On this page" rail and quick checks. Keep it. Small fixes: the level badge ("Working knowledge") and the prerequisites cards use the same border weight as the lesson cards; end every lesson with one "Try it in Case N" button that matches its "In practice" section.
- ✓ (15B.1 gave the sandbox its evidence, so UX.7 added "Want a guide?" instead of the interim callout) **Sandbox** offers only Linux commands (`ls`, `cat README.txt`, `grep examiner logs/auth.log`) on a workstation with no evidence, so a beginner can't practise the forensic tools there. That's prompt 15B.1's job (the sandbox case); until then the page should say "Evidence arrives in the sandbox with the full launch", and link to the lessons' practice terminals, which do have evidence.
- ✓ (UX.7) **Settings and What we store** follow the vendored forms and pass; they only need the §4 spacing rules.

### 2.9 Still open

Found in UX.8's review of the visual baselines (`tests/e2e/visual.spec.ts-snapshots/`) and its machine checks. Every machine check passes; INP is within budget on a quiet machine (`docs/runbook.md` §8, 2026-09-26). None of these stop a beginner; each needs a design decision or a file another prompt owned, so none was changed here.

| #   | Sev | What's still wrong                                                                                                                                                                                                              | Rule                        | Suggested fix                                                                                                                              | Owner                  |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| O1  | P2  | Two solid amber buttons on one workspace screen: the Now strip's **Write your report** and the Evidence Browser's empty-state **Open qf-lt-03** | §3.3 rule 6, §4.3 rule 1    | Make the empty state's action secondary while the Now strip carries a primary, or make the Now strip's action secondary until the report is the next step | Evidence Browser (UX.5) |
| O2  | P2  | The Timeline's segmented controls fill their selected option with solid amber (**Tracks**, **UTC**), so a state reads like a button                                                                                               | §3.3 rules 1 and 3          | Selected option on `--accent-subtle` with an amber outline or underline, like the selected workspace tab                                   | Timeline (UX.5)        |
| O3  | P2  | On a 360 × 780 phone the Now strip (objective, Write your report, Noor's newest message) takes about 45% of the height, leaving about a third of the screen for the view below it                                              | §4.3 rule 2 (and §2.5)      | On phones, show Noor's newest message as one line behind "n messages", or fold the strip to the objective alone once the view is scrolled   | Workspace (UX.3)       |
| O4  | P3  | On a phone the breadcrumb cuts the case title short ("Cases / The cl…") to fit beside SIMULATED and Search                                                                                                                     | §4.3 rule 2                 | Drop "Cases /" below 480 px (the back link is the sidebar) so the case title fits                                                        | Shell (UX.2)           |
| O5  | P2  | The visual baselines are Windows pictures, so `visual.spec.ts` skips on CI's Linux runner                                                                                                                                      | §8 "UX.8 visual review"     | Record Linux baselines once (`pnpm test:e2e tests/e2e/visual.spec.ts --update-snapshots` on Linux or in Playwright's Docker image) and commit them | Owner (runbook §9)     |
| O6  | P3  | `perf:vitals` counts 205.9 KB of script on the wire by the load event on `/cases/case-01` (201.0 KB at 15B.1), over its 200 KB line, while `bundle:check`, the budget CI enforces, has the page within budget. The two measure different things (the wire count includes chunks the page starts fetching before load) | §8 "Initial JS per page" | Find which chunk the case page starts before load that `bundle:check` doesn't count, and defer it past load | Case runner |

## 3. The theme: Lamplight

### 3.1 Why this theme

The game is about a **blue team in an evidence room**, working carefully after hours with a desk lamp on. The company is **Candlewright**. Hacker Simulation, the red-team sibling, is cyan-on-black: the hacker film look. This game should feel calmer and more deliberate: an ink-navy room, warm paper-white text, and **candle amber** for the one thing you can act on. It fits the blue team (navy), the brand (a candle's light) and the work (evidence bags, tags and forms are amber, manila and paper). It also keeps the dark, low-glare surface people need for a 45-minute session in a terminal.

### 3.2 Palette (applied in `src/styles/tokens.css`)

Ratios measured with `src/lib/contrast.ts`, on base / raised / overlay / accent-subtle. Text needs 4.5:1, non-text 3:1.

| Token                                       | Value                             | Role                                      | Ratios                    |
| ------------------------------------------- | --------------------------------- | ----------------------------------------- | ------------------------- |
| `--surface-base`                            | `#0f1117`                         | Page, ink navy                            | —                         |
| `--surface-raised`                          | `#171a22`                         | Cards, panes, terminal frame              | —                         |
| `--surface-overlay`                         | `#20242e`                         | Menus, hover, hint boxes                  | —                         |
| `--text-primary`                            | `#eeeae3`                         | Body and headings, warm paper white       | 15.7 / 14.5 / 12.9 / 12.8 |
| `--text-secondary`                          | `#c3c1bb`                         | Supporting text                           | 10.5 / 9.7 / 8.6 / 8.5    |
| `--text-muted`                              | `#9c9ea7`                         | Hints, captions, metadata                 | 7.1 / 6.5 / 5.8 / 5.7     |
| `--accent`                                  | `#f2b84b`                         | Candle amber: buttons, links, selection   | 10.5 / 9.7 / 8.7 / 8.6    |
| `--accent-hover`                            | `#ffd27e`                         | Hover                                     | —                         |
| `--accent-subtle`                           | `#2c2414`                         | Current nav item, first-objective callout | —                         |
| `--status-success`                          | `#5fd39a`                         | MATCH, done                               | 10.1 / 9.3 / 8.3 / 8.2    |
| `--status-warning`                          | `#ff9a5c`                         | Blocker off, the SIMULATED tape           | 9.0 / 8.3 / 7.4 / 7.3     |
| `--status-danger`                           | `#ff7c88`                         | MISMATCH, destructive actions             | 7.6 / 7.0 / 6.3 / 6.2     |
| `--status-info`                             | `#88b6ff`                         | Permission, notes, info                   | 9.2 / 8.4 / 7.5 / 7.4     |
| `--reward`                                  | `#c9a8ff`                         | Celebrations only                         | 9.5 / 8.7 / 7.8 / 7.7     |
| `--border-subtle`                           | `#2a2f3b`                         | Decorative dividers                       | excluded (decorative)     |
| `--border-strong`                           | `#6f7687`                         | Control edges                             | 4.2 / 3.8 / 3.4 / 3.4     |
| `--focus-ring`                              | `#ffd98f`                         | Keyboard focus                            | 14.0 / 12.9 / 11.5 / 11.4 |
| `--term-bg` / `--term-fg` / `--term-cursor` | `#0a0c11` / `#e3dfd6` / `#f2b84b` | Terminal                                  | fg 15+, cursor 10.9       |

Text on a solid amber fill uses `--surface-base`: 10.5:1. Compared with the old palette, the weakest text pair (muted on accent-subtle) went from **4.95:1 to 5.74:1** and the weakest border pair from **3.09:1 to 3.37:1**, so nothing got dimmer. The ANSI colours in the terminal are unchanged, so tool output keeps its meaning.

### 3.3 Colour rules (so nothing gets diminished)

1. **Amber means "you can act on this."** Buttons, links, the selected tab, focus. Never decoration, never status.
2. **Status colours always come with an icon or word** (already the rule): MATCH ✓ green, MISMATCH ✕ red, blocker off ⚠ orange.
3. **Warning orange and accent amber are neighbours**, so warning is always an outline, a dashed "tape" or an icon, never a solid button fill. Solid amber fills are only primary buttons.
4. **Reward violet is for moments**, not text you read: the tick, the stamp, a secret-found badge.
5. **Translucent tints (`bg-accent/10`, `/20`) are backgrounds only**; text on them uses `text-primary`, whose ratio holds on any tint of these surfaces.
6. **One solid-amber block per screen, at most.** The sidebar's Start here slab breaks this today (G2).

### 3.4 What's applied, and what isn't

Applied now: the tokens above in `src/styles/tokens.css` and the matching default terminal theme in `src/content/themes/index.ts` (its test requires them to match). Token names didn't change, so no component changed. `VENDORED.md` records it. `pnpm test` covers it with `contrast-audit`, `terminal-themes` and `no-hardcoded-colours`.

Not applied (UX.1): the logo mark, the "letter" and "evidence tag" card styles, the type scale, and the SIMULATED badge's single-instance rule.

### 3.5 Daylight, the light theme (prompt UX.9)

The same case file read by daylight: manila paper instead of ink navy, ink instead of paper white, and the amber darkened until it reads as text on paper. It's the `[data-theme="light"]` block in `src/styles/tokens.css`, chosen with the **Colours** setting on `/settings` (Dark, Light or Match my device; Dark by default). The boot script sets it before first paint, and "Match my device" follows the device when it switches. The terminal stays dark: Daylight never touches `--term-*`, and the terminal's frame sets `data-theme="dark"`, so its header and menus keep the Lamplight tokens. The colour rules in §3.3 hold unchanged.

Ratios on base / raised / overlay / accent-subtle, from the same audit, which now measures both themes.

| Token               | Value     | Ratios                                |
| ------------------- | --------- | ------------------------------------- |
| `--surface-base`    | `#f3ead6` | —                                     |
| `--surface-raised`  | `#fbf7ee` | —                                     |
| `--surface-overlay` | `#eadfc6` | —                                     |
| `--text-primary`    | `#1b1e27` | 13.9 / 15.5 / 12.5 / 12.5             |
| `--text-secondary`  | `#3d4150` | 8.4 / 9.4 / 7.6 / 7.6                 |
| `--text-muted`      | `#595c68` | 5.5 / 6.2 / 5.0 / 5.0                 |
| `--accent`          | `#8a4f00` | 5.4 / 6.1 / 4.9 / 4.9                 |
| `--accent-hover`    | `#6b3c00` | 7.7 / 8.6 / 6.9 / 6.9                 |
| `--accent-subtle`   | `#f2deb0` | —                                     |
| `--status-success`  | `#1d6b40` | 5.4 / 6.0 / 4.9 / 4.9                 |
| `--status-warning`  | `#a3420a` | 5.2 / 5.8 / 4.7 / 4.7                 |
| `--status-danger`   | `#b0222c` | 5.6 / 6.3 / 5.1 / 5.0                 |
| `--status-info`     | `#1d539f` | 6.2 / 7.0 / 5.6 / 5.6                 |
| `--reward`          | `#6a3cb0` | 6.0 / 6.8 / 5.5 / 5.4                 |
| `--border-subtle`   | `#dccfb3` | excluded (decorative)                 |
| `--border-strong`   | `#817764` | 3.6 / 4.1 / 3.3 / 3.3                 |
| `--focus-ring`      | `#b8690a` | 3.4 / 3.8 / 3.1 / 3.1; 4.7 on the terminal |

Text on a solid fill is still `--surface-base` (paper on dark amber: 5.4:1). Warning leans red (`#a3420a`) so it never reads as the accent's brown-amber.

## 4. Layout, whitespace and hierarchy rules

### 4.1 Spacing

A 4 px base, used as a short scale: **4 · 8 · 12 · 16 · 24 · 32 · 48 · 64**.

| Where                                                          | Rule                              |
| -------------------------------------------------------------- | --------------------------------- |
| Inside a control                                               | 8–12                              |
| Between related items (a label and its field, items in a list) | 8–12                              |
| Card padding                                                   | 16 (dense panes) or 20–24 (pages) |
| Between sections in a pane                                     | 24                                |
| Between sections on a page                                     | 32–48                             |
| Page top padding                                               | 32 (app), 64+ (landing hero)      |

Readable text stays under **70 characters** a line (`max-w-prose` or `max-w-2xl`). Panes that hold tables are the exception.

### 4.2 Type roles

Keep Geist and Geist Mono (no new font download, no layout shift). Name the roles instead of picking sizes ad hoc:

| Role          | Style                                                   | Use                                               |
| ------------- | ------------------------------------------------------- | ------------------------------------------------- |
| Display       | 48/52, semibold, tight                                  | Landing H1 only                                   |
| Page title    | 30/36, semibold                                         | H1 on every page                                  |
| Section title | 20/28, semibold                                         | H2                                                |
| Eyebrow       | 12/16, semibold, uppercase, tracking-wide, `text-muted` | Labels above titles ("Case 1 · About 15 minutes") |
| Body          | 16/28                                                   | Reading                                           |
| Small         | 14/20                                                   | Captions, metadata, help                          |
| Data          | Geist Mono 13–14                                        | Paths, hashes, refs, times                        |

Put these as `@utility` classes in `src/styles/` (`type-page-title`, `type-eyebrow`, …) so a component can't drift.

### 4.3 Hierarchy per screen

1. **One primary button per screen**, and it's the next step.
2. **The current task is the brightest thing** after the primary button.
3. Everything that's done collapses.
4. Destructive actions live in a menu with a confirm dialog.
5. Empty states follow the 99 §Voice template and carry one action.

## 5. Motion plan, component by component

Every effect uses the existing tokens in `src/styles/motion.css`, scales with `--motion-scale` (so it lands on its still state under reduced motion), stays under 1.5 s, never blocks input, and gets a line in `tests/unit/motion.test.ts`.

| Component                                | Motion                                                                                     | Duration             | Purpose                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------ |
| Buttons                                  | Colour transition; 1 px press-down on `:active`                                            | fast                 | Feedback                                   |
| Workspace tabs                           | The selected underline slides between tabs                                                 | base                 | Shows where you moved                      |
| Tab badge (Board count, new-message dot) | `pop` once when it changes                                                                 | celebrate            | "Something landed here"                    |
| `pin` (terminal, browser row, timeline)  | The line flashes amber for a moment; the Board tab badge pops                              | base + celebrate     | Links the action to where it went          |
| Board card added                         | `rise-in`                                                                                  | slow                 | Arrival                                    |
| Board card removed                       | Fades out; Undo toast slides up                                                            | base                 | Undo is findable                           |
| Objective ticked                         | Existing `tick-fill` and `tick-glow`; the next objective expands with `rise-in`            | celebrate            | Reward, then "here's next"                 |
| Team message arrives                     | Slides in under the current objective; typewriter as now                                   | base                 | Story beat without moving the checklist    |
| `hashsum --verify` MATCH                 | The MATCH line gets a one-pass highlight sweep, left to right                              | celebrate            | The case's key moment                      |
| MISMATCH                                 | No shake. A still red rule and Noor's line                                                 | —                    | Consequence, not punishment (world rule 6) |
| Evidence Browser tree                    | Chevron rotates; children fade in                                                          | fast                 | Orientation                                |
| Split handle / Focus pane                | Width eases                                                                                | base                 | Spatial continuity                         |
| Pane loading                             | Skeleton rows with a slow shimmer                                                          | loop                 | Instead of a spinner and a sentence        |
| Report submitted                         | Each finding's status chip resolves in turn, 80 ms apart                                   | celebrate-long total | Suspense without delay                     |
| Debrief                                  | A "Case closed" stamp lands (`pop` plus a slight rotate), then "n of m findings supported" | celebrate            | The one big moment                         |
| Landing loop strip                       | Four steps light up in order once, then stay lit                                           | celebrate-long       | Explains the game without reading          |
| Dialogs, menus, toasts                   | Existing `fade-in`                                                                         | base                 | —                                          |

No timers, no counters that run down, no confetti on partial results, no animated numbers that go _down_.

## 6. The intended beginner flow

```
/            → one sentence, one picture, "Open Case 1"
briefing     → two lines of story, the first objective, the signed letter, Start case (always visible)
workspace    → "Now" objective in view, terminal with suggestions for it, panes one click away
first tick   → < 2 min: reward, next objective opens by itself
pin          → line flashes, Board badge pops: the player learns where evidence goes
report       → numbered questions, cite pins as cards
debrief      → Case closed stamp, n of m supported, custody log, "Next case"
```

The workspace, redrawn:

```
┌ rail ┬───────────────────────────────────────────────────────────────────────┐
│  ▣   │ Cases / The clean copy        ◔ 1 of 5     [SIMULATED]   [⋯ Case]      │
│  ▣   ├───────────────────────────────────────────────────────────────────────┤
│  ▣   │ NOW  Check the write-blocker before anything reads the drive  [Hint]   │
│      │      Noor: "Kit, the drive has a fingerprint on that form…"  (2 more) │
│      ├──────────────────────────────┬┬──────────────────────────────────────┤
│      │ examiner@ir-ws-01 [SIMULATED]││ Objectives · Evidence · Timeline · Board 3 │
│      │ $ cat handover.txt           ││                                      │
│      │ …                            ││  (pane scrolls on its own)            │
│      │ Try: blocker --help  lsfs    ││                                      │
│      │ $ █                          ││                           [⤢ Focus]   │
└──────┴──────────────────────────────┴┴──────────────────────────────────────┘
         both columns fill the viewport; the ‖ handle resizes with mouse or keys
```

Below 1024 px: the same "Now" strip, then one view at a time with a bottom tab bar (Terminal · Objectives · Evidence · Timeline · Board).

## 7. Prompts

### Waves

| Wave       | Prompts                                 | Mode                          | When                                                                                                              |
| ---------- | --------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| UX-A       | UX.1                                    | alone                         | Now. Only touches the design system                                                                               |
| UX-B       | UX.2 ‖ UX.3 ‖ UX.4 ‖ UX.5 ‖ UX.6 ‖ UX.7 | parallel, merge in that order | After 08 merges. Can run alongside 11 and 12 (content only); **before 14**, which adds mentor UI to these screens |
| UX-C       | UX.8                                    | alone                         | Before 15 part B                                                                                                  |
| (optional) | UX.9                                    | alone                         | Any time after UX-C                                                                                               |

Each prompt starts with the preamble from 00 §6 and owns only the paths it lists. Rules for shared files: `src/components/ui/**` is UX.1's; later prompts use its primitives and ask for new ones in their commit message rather than editing them. A later prompt that needs a UI primitive changed adds it in its own feature folder and notes it for UX.8.

### Prompt UX.1 — design system: theme finish, type scale, primitives

**Owns:** `src/styles/**`, `src/components/ui/**`, `src/app/(dev)/styleguide/**`, `src/lib/contrast-audit.ts`, `tests/unit/{motion,contrast-audit,no-hardcoded-colours}.test.ts`, `VENDORED.md` rows for these.

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md and UIUX.md (§3, §4, §5).
Read VENDORED.md before changing a vendored file, and update its row after.
The Lamplight colour tokens are already in src/styles/tokens.css. Finish the design system:
1. Type roles from UIUX §4.2 as @utility classes in src/styles/ (type-display, type-page-title,
   type-section-title, type-eyebrow, type-body, type-small, type-data). Show them on /styleguide.
2. A `letter` Card variant (paper-toned: raised surface, a top rule in --status-info, "Signed:" line
   slot) and an `evidence-tag` Badge tone (amber outline, mono, for refs), both using audited pairs only.
3. ObjectiveTick: the success sentence in text-primary with a reward-coloured left rule and tick
   (UIUX G6). Add a `current` status that shows the objective expanded with a "Now" eyebrow.
4. SimulatedBadge: add a `tape` look (dashed warning outline, as now) and a compact size for headers.
   Document the rule "once per view: shell top bar plus any terminal" in its doc comment.
5. A Menu primitive (button + popover list, ARIA menu pattern, Escape closes, focus returns) for the
   "⋯ Case" overflow menu, and a SplitPane primitive (a separator with role="separator",
   aria-valuenow, arrow keys move it 5%, Home/End snap, double-click resets).
6. New motion from UIUX §5 that belongs to primitives: tab-indicator slide, badge pop, line flash
   (for pin), stamp (pop + 4° rotate), sweep highlight, skeleton shimmer. Every one scales with
   --motion-scale; extend tests/unit/motion.test.ts.
7. Replace the `>▌` logo with a simple candle-flame mark (inline SVG, currentColor, aria-hidden).
Show every new piece on /styleguide in both motion modes. The contrast audit must still pass.
Finish with pnpm lint, pnpm typecheck, pnpm test and pnpm build green, then commit.
```

**Done when:** `/styleguide` shows every role, variant and animation; no raw sizes remain in the new primitives; the motion and contrast tests pass.

### Prompt UX.2 — shell, landing and case list

**Owns:** `src/components/shell/**`, `src/lib/next-step.ts`, `src/app/(marketing)/**`, `src/app/(app)/cases/page.tsx`, `src/features/cases/components/case-list.tsx`, `src/features/cases/run/catalog.ts` (listing state only), `src/content/release.ts` (copy only), `tests/e2e/a11y.spec.ts` additions.

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md (§Voice) and UIUX.md (§2.1–2.3,
§4, §6). Use the primitives from UX.1; don't edit src/components/ui/.
1. Start here becomes context-aware (UIUX G2): on a case's own page it hides; with a saved run it
   reads "Continue Case 1 · 1 of 5"; it's a raised card with an amber icon, not a solid slab.
   Read saved runs through src/lib/case-storage's public API only.
2. The top bar shows a breadcrumb (Cases / The clean copy) instead of repeating the section name,
   keeps Search and the one SIMULATED badge. Inside a case run the sidebar starts collapsed to the
   rail and restores its setting when you leave (don't overwrite the user's saved choice).
3. Landing page per UIUX §2.2: eyebrow + H1, the pitch, one primary button, "What you'll do in
   Case 1" as three steps, the loop strip (static SVG; the step-by-step light-up from §5 is
   motion-scaled), a small top bar with Learn and Sandbox, and the disclaimers in a quieter block.
   One SIMULATED marker. Keep the copy in src/content/release.ts so the voice test reads it.
4. Case list per §2.3: case number, time, state from the saved run (not started / in progress n of m
   / closed with n of m findings supported), a button that says what happens ("Open Case 1",
   "Continue", "Read the debrief"), practice cases in their own labelled row, unreleased cases quiet.
Keep the landing page's initial JS within its bundle baseline (pnpm build && pnpm bundle:check).
axe must pass on / and /cases. Finish with pnpm lint, pnpm typecheck, pnpm test and pnpm build
green, then commit.
```

**Done when:** a first-time visitor sees one main button per page; a returning player sees where they left off from `/cases` and the sidebar.

### Prompt UX.3 — briefing, workspace layout and objectives

**Owns:** `src/features/cases/components/{case-briefing,case-workspace,case-runner,case-play,objectives-pane,storage-banner,later-pane}.tsx`, `src/features/cases/workspace-panes.ts` (order only), `tests/components/` for these, `tests/e2e/case-01.spec.ts` selectors if they move.

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/05-workspace-ui.md, docs/plan/10-case-board-report-custody.md
and UIUX.md (§2.4, §2.5, §4, §5, §6). Use the UX.1 primitives (Menu, SplitPane, ObjectiveTick
current, letter Card). Other agents own the terminal, the panes' insides, the report and debrief.
1. Briefing: a sticky action bar with Start case, the time and "Hints are free"; the written
   permission as a letter card with scope as ✓/✕ items; section headings use the type roles.
2. Workspace fills the viewport below the app header (100dvh minus header; no page scroll on
   desktop). Terminal and pane scroll on their own. A SplitPane between them; a Focus pane toggle
   that gives the pane the full width and turns the terminal into a drawer (Esc closes, focus returns).
3. The header: breadcrumb-free title (the shell has it), a compact progress ring, and a "⋯ Case" Menu
   holding Start the case again (with the existing confirm dialog). No second SIMULATED badge.
4. A "Now" strip under the header: the current objective, its Why on demand, Show a hint, and the
   newest team message ("n earlier messages" opens the full chat). New messages slide in there.
5. Objectives pane: current objective expanded, later ones titles only, done ones collapsed with
   their success line on expand. Tabs in the order Objectives · Evidence · Timeline · Board, with a
   count on Board and a new-content dot, using the tab-indicator slide and badge pop.
6. Below 1024 px: the Now strip, then one view at a time with a bottom tab bar; the terminal's input
   stays above the on-screen keyboard.
Keep every existing keyboard path and ARIA pattern working; update component tests and the case-01
Playwright spec (desktop and 360 px), axe on every screen. Hints stay free and never change grading.
Finish with pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm test:e2e green, then commit.
```

**Done when:** at 1440 × 900 and at 360 px the current objective, the prompt and the tabs are all visible without scrolling after ten commands; the first tick still lands in under 2 minutes in the e2e spec.

### Prompt UX.4 — terminal

**Owns:** `src/features/terminal/**` (vendored: update `VENDORED.md`), `tests/components/terminal*`.

```text
Read CLAUDE.md, VENDORED.md and UIUX.md (§2.6, §5). The terminal is vendored: record each change.
1. Suggestion chips follow the case: add an optional `suggestions` prop, and pass it with one line
   in src/features/cases/components/case-workspace.tsx (UX.3 owns that file and merges first; this
   line is your only edit there). Fill it from the current objective's tool names, never a hint's
   full answer; commands already run successfully drop out.
   With no prop, keep today's behaviour for the sandbox and lessons.
2. "What just happened?" moves to the end of the output block (shown on hover and focus of the
   block, always reachable by keyboard), so the command line never wraps because of it.
3. Hex values (hashes) render on their own line with break-all and a copy button; refs keep working.
4. Each command's output gets 8 px of space and a faint left rule; the pin line flash from UX.1.
5. Help, Copy transcript and Reset machine: Help stays a button, the other two go into the UX.1 Menu.
Keep the golden transcripts unchanged (these are presentation changes). Beginner mode, the
typewriter and reduced motion must still behave as before. Finish with pnpm lint, pnpm typecheck,
pnpm test and pnpm build green, then commit.
```

### Prompt UX.5 — Evidence Browser, Timeline and Board panes

**Owns:** `src/features/evidence-browser/**`, `src/features/timeline/**`, `src/features/case-board/**`, their component tests, `tests/e2e/timeline-performance.spec.ts`.

```text
Read docs/plan/05-workspace-ui.md (§Evidence Browser), 09-timeline.md (§The view),
10-case-board-report-custody.md (§Case Board) and UIUX.md (§2.5, §5).
1. Evidence Browser: below 900 px of pane width, a drill-in layout (drives → folders → records →
   detail) with a breadcrumb and Back, instead of stacking all three. At full width (Focus pane),
   the three-column Autopsy layout. Filters appear only once a drive is open, in a collapsible bar;
   style the date inputs with the tokens. Empty state per 99 §Voice with one action ("Open qf-lt-03").
2. Timeline: the same Focus-pane awareness (more tracks visible at full width); skeleton while
   loading; the zone banner as an info callout at the top.
3. Board: cards as evidence tags (the UX.1 evidence-tag badge for the ref, source icon, time in
   mono), rise-in on arrival, fade on remove with the Undo toast.
4. Re-check the freeze seen once in UIUX §2.5 (switching Timeline → Board after a few commands):
   record a performance trace in the Playwright timeline spec and fix any long task over 200 ms.
Every keyboard map stays the same. axe must pass with each pane open; pnpm bundle:check must pass
(these panes load on demand). Finish with pnpm lint, pnpm typecheck, pnpm test and pnpm build green,
then commit.
```

### Prompt UX.6 — report and debrief

**Owns:** `src/features/cases/components/report/**`, `src/features/cases/components/debrief/**`, their tests, the report and debrief steps of `tests/e2e/case-01.spec.ts`.

```text
Read docs/plan/10-case-board-report-custody.md and UIUX.md (§2.7, §5). Grading stays exactly as it
is: only presentation changes.
1. Report: numbered questions with a progress line ("2 of 3 answered, 1 with evidence"); Supporting
   evidence as selectable pin cards (checkbox semantics) with source badge and ref; a sticky Submit bar.
2. On submit, each finding's chip resolves in turn (motion-scaled), with the status words
   supported / needs evidence / not yet always in text.
3. Debrief: lead with the Case closed stamp and "n of m findings supported", then findings, then the
   custody log and its export, then objectives (compact). Actions: one primary (Next case, or Back to
   your cases while the next is unreleased), Back to the workspace secondary, restart in a Menu.
No numeric score, nothing that goes down. Keyboard-only and axe checks in the e2e spec.
Finish with pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm test:e2e green, then commit.
```

### Prompt UX.7 — Learning Center, sandbox, settings and privacy

**Owns:** `src/app/(app)/learn/**`, `src/features/learning/components/**` (vendored rows), `src/app/(app)/sandbox/**` (layout and copy only; 15B owns the sandbox case), `src/app/(app)/settings/**`, `src/app/(marketing)/privacy/**` (layout only).

```text
Read docs/plan/13-learning-center.md, docs/plan/15-quality-and-launch.md (Part B, §Sandbox) and
UIUX.md (§2.8, §4). Keep lesson content unchanged.
1. Apply the type roles and spacing rules; lesson cards, level badges and prerequisite cards get
   distinct weights (UIUX §2.8).
2. End every lesson with one "Try it in Case N" button from its "In practice" section's case id.
3. Sandbox: until 15B lands, a callout "Evidence arrives in the sandbox with the full launch", and
   a link to the lessons whose practice terminals carry evidence. Keep one SIMULATED marker.
4. Settings and What we store: spacing and headings per §4; nothing about what's stored changes.
axe must pass on every /learn route, /sandbox, /settings and /privacy. Finish with pnpm lint,
pnpm typecheck, pnpm test and pnpm build green, then commit.
```

### Prompt UX.8 — verification pass

**Owns:** `tests/e2e/**` (new specs), `docs/runbook.md` (a UI review checklist), this file's status lines.

```text
Read UIUX.md whole. Every UX prompt has merged.
1. Add tests/e2e/visual.spec.ts: Playwright screenshots (toHaveScreenshot) of /, /cases, the case-01
   briefing, workspace (each pane), report and debrief, at 1440×900 and 360×780, with motion reduced
   so they're stable. Commit the baselines.
2. A viewport test: after the ten commands in the case-01 playthrough, the current objective, the
   prompt and the tab bar are all inside the viewport at both sizes.
3. Run axe on every route with every pane open, keyboard-only through case-01, pnpm bundle:check,
   pnpm perf:vitals. Fix what fails.
4. Tick the critique items in UIUX §2 that are done, and list anything left in a "Still open" table.
5. Add the UI review checklist (§4.3 hierarchy rules, §3.3 colour rules) to docs/runbook.md for
   future cases 2 and 3.
Commit when everything that a machine can check is green.
```

### Prompt UX.9 (optional) — "Daylight" case-file theme

`docs/plan/15` asks for axe "in light and dark themes", and there's only one theme today.

**Owns:** `src/styles/tokens.css` (a new block only), `src/lib/contrast-audit.ts`, `src/lib/settings/**` (one setting), `src/components/settings/**`, the boot script.

```text
Read UIUX.md (§3) and src/styles/tokens.css's header comment. Add a light "Daylight" theme as one
[data-theme="light"] block: manila-paper surfaces, ink text, a darker amber accent that passes 4.5:1
as text on paper, and status colours re-picked for a light ground. The terminal stays dark (its
themes are dark by design). Extend the contrast audit to measure both themes. Add an app theme
setting (System, Dark, Light), applied before first paint by the boot script, defaulting to Dark.
Run axe in both themes on every route. Finish with pnpm lint, pnpm typecheck, pnpm test and
pnpm build green, then commit.
```

## 8. How we'll know it worked

| Measure                                    | Target                                              | Checked by                  |
| ------------------------------------------ | --------------------------------------------------- | --------------------------- |
| First objective ticks                      | Under 2 minutes                                     | `tests/e2e/case-01.spec.ts` |
| Current objective, prompt and tabs in view | Always, at 1440 × 900 and 360 px                    | UX.8 viewport test          |
| Text contrast                              | ≥ 4.5:1 on every surface; borders and focus ≥ 3:1   | `contrast-audit` test       |
| SIMULATED markers per view                 | 1, plus one per terminal                            | UX.8 visual review          |
| Solid amber blocks per screen              | ≤ 1                                                 | UX.8 visual review          |
| Initial JS per page                        | Under 200 KB, within baseline                       | `pnpm bundle:check`         |
| LCP / INP / CLS                            | < 2.5 s / < 200 ms / < 0.1                          | `pnpm perf:vitals`          |
| Playtest                                   | Most beginners finish Case 1 without the third hint | Runbook playtest kit (15)   |
