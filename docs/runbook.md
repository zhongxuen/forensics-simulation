# Runbook: Candlewright: Incident Room

How the site is deployed, what it needs, how to take a release back, and how to run a playtest. Written for the "Case 1 only" release (`docs/plan/15-quality-and-launch.md`, part A, 2026-09-24), and updated for the full launch (part B, prompt 15B.1, 2026-09-25): all three cases released, and the sandbox.

The operations sections follow Hacker Simulation's runbook (`../hacker-simulation/md-files/remaining.md`, "Operations runbook" and "Playtest kit"), because the two sites share an engine, a posture and an owner.

---

## 1. The Vercel project

The project already exists. **Don't recreate it.** These are its settings as read from Vercel on 2026-09-24, so a change shows up as a difference from this table.

| Setting                  | Value                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team                     | Goh Zhong Xuen's projects (`goh-zhong-xuen-s-projects`, `team_yHlRZjvc2WyDzYY189bLWIh6`)                                                                                                        |
| Project                  | `forensics-simulation` (`prj_5YkPWMZsDk6QihlDcWUBuwteso0T`), created 2026-09-22 from the GitHub repo `zhongxuen/forensics-simulation`                                                            |
| Framework preset         | Next.js (also pinned in `vercel.json` as `"framework": "nextjs"`, as Hacker Simulation does)                                                                                                    |
| Node.js                  | 24.x                                                                                                                                                                                           |
| Production branch        | `main`. Every push to `main` builds and deploys production through the Git integration. **Nothing in CI deploys**                                                                              |
| Build / install commands | The preset's defaults: `pnpm install` (pnpm is pinned by `packageManager` in `package.json`) and `pnpm build`                                                                                    |
| Domains                  | `forensics-simulation.vercel.app` (production), `forensics-simulation-goh-zhong-xuen-s-projects.vercel.app`, `forensics-simulation-git-main-goh-zhong-xuen-s-projects.vercel.app`                 |
| Deployment Protection    | Vercel Authentication, **Standard Protection**. The API still reports it as `all_except_custom_domains`, but the production `.vercel.app` address is public (checked with a logged-out `curl`, 2026-09-24). Previews stay behind Vercel's login |
| Password protection      | Off (it needs Pro)                                                                                                                                                                             |
| Firewall                 | No custom rules yet. The mentor shipped with plan file 14, so the rate-limit rule in §3 is now an owner step                                                                                   |

**Environments.** Production = every merge to `main` → https://forensics-simulation.vercel.app, public. Preview = every other push and every PR, behind Vercel Authentication. Local = `pnpm dev`.

## 2. Environment variables

**None are needed, and the game is complete without them.** It is static pages plus evidence chunks, with no database, no accounts and no cookies. The only server code is the three optional mentor routes (plan file 14): with no key set they answer at once with the authored text, and nothing errors.

| Variable            | When                             | What it does                                                                                                                          |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Optional                         | The mentor's model key. Absent means every hint is the written one, and nothing errors. Server-only: never prefix it `NEXT_PUBLIC_`   |
| `MENTOR_DISABLED`   | Optional                         | Kill switch: `1` stops every model call at once and serves the written text. No redeploy of the app is needed, just the variable       |
| `MENTOR_MODEL`      | Optional                         | Overrides the model id. Default `claude-haiku-4-5` (00 §7)                                                                            |

`pnpm security:bundle` fails the build if a secret, a server-only variable name or the Anthropic SDK reaches a file a browser can download. Never add `DATABASE_URL`, `POSTGRES_*`, `SUPABASE_*`, `MONGODB_URI` or `REDIS_URL`: `tests/unit/no-database.test.ts` fails if a `.env` file has one.

**Owner step, now that the mentor has shipped.** Follow Hacker Simulation's key steps: separate production and preview Anthropic workspaces and keys, each with a monthly spend limit and alerts at 50% and 80%. Add the production key scoped to **Production**, the preview key scoped to **Preview**, both marked **Sensitive**, then redeploy.

## 3. The firewall rate-limit rule for `/api/mentor/*`

**Owner step, now due.** The three mentor routes are live, so there is something to limit. The rule is copied from Hacker Simulation's runbook.

Per-IP limiting is a Vercel WAF rate-limit rule (there are no accounts, so the IP is the only key). Hobby includes one rule per project, which is all this needs. A throttled request gets a 429, and the browser treats any non-OK status as "use the written text", so a player over the limit still gets the hint, never an error. Never go straight to blocking:

```bash
# 1. Log mode first: records hits, blocks nothing.
vercel firewall rules add "Mentor rate limit" \
  --condition '{"type":"path","op":"pre","value":"/api/mentor/"}' \
  --action rate_limit --rate-limit-window 60 --rate-limit-requests 20 \
  --rate-limit-keys ip --rate-limit-action log --yes
vercel firewall diff && vercel firewall publish --yes

# 2. After a few days of traffic (Firewall → Traffic, filtered by the rule), switch to 429:
vercel firewall rules edit "Mentor rate limit" \
  --condition '{"type":"path","op":"pre","value":"/api/mentor/"}' \
  --action rate_limit --rate-limit-window 60 --rate-limit-requests 10 \
  --rate-limit-keys ip --rate-limit-action rate_limit --yes
vercel firewall publish --yes
```

About 10 requests a minute per IP is generous for one player (a hint is a deliberate click). Watch for a classroom behind one school IP, and raise the limit if it trips. Counters are per region, so the effective limit is a few times the configured one. The goal is to cap abuse, not to be exact.

## 4. Shipping

Branch → push → PR → CI green ("CI passed") → merge. Vercel builds production from `main`. Then smoke-test it (once production is public, §6):

```bash
curl -sI https://forensics-simulation.vercel.app/ | grep -iE "content-security-policy|strict-transport|x-frame|set-cookie"
# expect the CSP (no unsafe-eval), HSTS and X-Frame-Options, and no set-cookie
E2E_BASE_URL=https://forensics-simulation.vercel.app pnpm test:e2e
```

What CI checks on every push (`.github/workflows/ci.yml`): lint, types, format, the dependency audit, unit, content and component tests, `evidence:check`, `case:validate --strict`, coverage gates, the production build, `bundle:check`, `security:bundle`, and the Playwright suite (axe on every route and on the sandbox terminal in each of its five colour themes, all three cases keyboard-only on a desktop and a 360 px phone with axe on every screen, reduced motion, security headers).

`pnpm perf:vitals` isn't in CI (it needs a quiet machine). Run it before a release against `pnpm build && pnpm start`.

## 5. Rolling back

Nothing is stored on the server. Players' case runs live in their own browsers (`incident-room:cases:v1`), so a rollback is only ever about code. A save made on a newer version is Zod-parsed on load, and a run the older version can't read is left out (that case starts at its briefing), never a crash.

- **Fastest:** Vercel → Deployments → the last good one ("Rollback candidate") → ⋯ → **Instant Rollback**. It takes seconds, with no rebuild. `vercel rollback` does the same.
- Afterwards Vercel **stops auto-promoting** pushes to `main`, so a fix doesn't go live by surprise. **Promote** the fix when it looks right, which turns auto-promotion back on.
- Then fix forward with `git revert` on a branch. Never force-push `main`.
- _Only the mentor misbehaving_? Don't roll back: set `MENTOR_DISABLED=1` in Production. Every hint goes back to the authored text at once, and the rest of the game is untouched.

**The rehearsal, once, on a quiet day:** note the current deployment id → Instant Rollback to the previous candidate → load the site and confirm it changed → Promote the newer one back → confirm automatic promotion is on again. Write the date in §8.

## 6. Owner steps for the "Case 1 only" release

These need a dashboard or a person. Tick them here as they're done.

- [x] Create the Vercel project from the GitHub repo (`forensics-simulation`, 2026-09-22)
- [x] Production branch is `main`
- [x] **Make production public**: Vercel Authentication set to Standard Protection, which leaves the production `.vercel.app` address public (2026-09-24)
- [x] Require the **"CI passed"** check on `main`: a GitHub ruleset that also blocks force pushes and deletion (2026-09-24)
- [x] Turn on Web Analytics and Speed Insights (Vercel → project). Page views and vitals work on Hobby. Custom events need Pro (2026-09-24)
- [x] Rehearse a rollback once (§5) and write the date in §8 (2026-09-24)
- [ ] Screen reader pass (§7) and the playtests (§7)
- [ ] Add the firewall rule (§3) — **due**: the mentor shipped with plan file 14

## 6b. Owner steps for the full launch (15B.1)

Everything a machine can check passed on 2026-09-25 (§8), except the INP budget in `pnpm perf:vitals`, which is written up below. These need a person or a dashboard:

- [ ] **Merge to `main`**. The work is on `learning-13.2` (waves 4 and 5 merged into it, then Case 3 and 15B.1). Open a PR to `main`, let CI go green, merge. Vercel deploys production from `main`
- [ ] **Smoke-test production** (§4): headers with `curl`, then `E2E_BASE_URL=https://forensics-simulation.vercel.app pnpm test:e2e`, and write the result in §8
- [ ] **Screen reader pass** (§7), now through all three cases' first five minutes and the sandbox
- [ ] **Playtests** (§7): three people with no security background play Case 1, and one of them plays all three. Record stuck points and fixes in §8
- [x] **INP on a quiet machine.** Rerun in UX.8 (2026-09-26, §8) with nothing else running: every page within budget. Still worth reading Speed Insights' real-visitor INP after a week of traffic, since a busy machine pushes the lab number over ("Known limits" below). A real phone is still untested
- [ ] **Firewall rule** (§3), still due: the mentor is live
- [ ] Optional: add `ANTHROPIC_API_KEY` (§2). The game is complete without it

## 7. What a machine can't check

### Screen reader pass

NVDA (Windows) or VoiceOver (macOS), about an hour, through Case 1's first five minutes. axe can't tell you whether the terminal makes sense read aloud.

- [ ] The landing page reads as: title, the SIMULATED line, the one-sentence pitch, "Open Case 1"
- [ ] The briefing's two opening lines say who is speaking
- [ ] After Start case, focus lands on the case heading, and the workspace's tabs announce as tabs
- [ ] Each command's result is announced (the terminal's `aria-live` summary), not only the raw output
- [ ] An objective ticking is announced, and a hint can be opened and read
- [ ] `pin` says what was pinned. The report's radio groups and the time field read with their question
- [ ] The debrief's "n of m findings supported" is reached and read
- [ ] Case 2: the owner's message and the door log read as documents; a report question's Supporting evidence checkboxes read with the pin's note
- [ ] Case 2: after a choice-beat answer, Noor's line on the debrief says who is speaking, and "Change your report" is reached
- [ ] Case 3: the Evidence Browser's Processes table reads its caption, column headers and the "In active list?" column
- [ ] Case 3: the "Which process is the problem?" picker reads each board item; the chapter closing on the debrief reads Idris's line and says the Hacker Simulation link opens in a new tab
- [ ] Sandbox: the heading says there are no goals, and "Try this first" and the cheat sheet are reachable after the terminal

### Playtest kit

**Who:** at least three people with **no** security, networking or Linux background (friends, family, students, not developers) play Case 1. One plays it again when Cases 2 and 3 are out. Ask permission to take notes, and never keep anything with a name in the repo (use "P1", "P2").

**Before:** a normal laptop browser window (13–15", not full screen), https://forensics-simulation.vercel.app on the landing page, a fresh profile or private window, your notes page and a clock.

**What to say, then stop talking:**

> "This is a game about how investigators work out what happened to a computer. Please play it for about 20 minutes. I'm not testing you, I'm testing the game: if something's confusing, that's the game's fault, and it's exactly what I need to find. Please think out loud as you go. I won't help, because I want to see where the game fails to."

**While they play: watch, don't help.** Don't answer questions ("What do you think it wants?"), don't point or lean in, and don't explain a term: if they don't know a word, that's a finding. If they're stuck for 3 minutes and getting unhappy, say "Let's move on" and note it.

**Write down, with times:** every hesitation (a pause of more than a few seconds), every confusion, every smile or "oh!" and what caused it, every hint opened and which tier, anything surprising they said, and **the time of their first objective tick** (target: under 2 minutes from landing).

**Afterwards, exactly these three questions,** recording their words, not your summary: What was the most fun part? Where did you feel lost? Would you come back tomorrow, why or why not?

**Then the "explain one thing" check:** "Can you explain, in your own words, one thing you learned?" If they can explain an **idea** (why you copy a drive before looking at it, what a hash proves), the case taught it. If they can only recall **steps** ("I typed acquire and then…"), it taught the steps, not the idea. Note which idea is missing.

**The rule afterwards:** if most players need the third hint on a step, **rewrite the step** (the case YAML, a lesson, or the UI copy), never add a fourth hint. Record each stuck point, the fix and the commit in §8.

## 8. Record

| Date       | What                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-22 | Vercel project created from the repo, production branch `main`                                                                                                                                                                                                                                                                                                                            |
| 2026-09-24 | "Case 1 only" release prepared (15A.1). Machine-checked: lint, types, format, 122 Vitest files, `evidence:check`, `case:validate --strict`, coverage (`src/sim` 91.2 / 81.1 / 95.4 / 94.3, at Hacker Simulation's gates), `bundle:check` (largest page 182.7 KB), `security:bundle`, Playwright (axe, Case 1 keyboard-only on desktop and 360 px, reduced motion, headers). `perf:vitals` on a throttled phone profile: `/` LCP 1472 ms, INP 48 ms, CLS 0.015; `/cases` 1400 ms, 160 ms, 0; `/cases/case-01` 1576 ms, **192 ms** (Start case, close to the 200 ms budget: watch it), 0 |
| 2026-09-24 | Released. `main` pushed, CI green, production public. Smoke test against production: every route 200 (`/styleguide` 404), CSP without `unsafe-eval`, HSTS, `X-Frame-Options`, no `set-cookie`, and all 43 Playwright tests passed with `E2E_BASE_URL` set to production. "CI passed" required on `main`, Web Analytics and Speed Insights on |
| 2026-09-24 | Rollback rehearsed: Instant Rollback from 15A.1 (`dpl_Hv58…`) to 02.2 (`dpl_3PNw…`), then Promote back to 15A.1. "Open Case 1" back on `/` afterwards |
| —          | Automatic promotion confirmed on (the next merge to `main` goes live without a Promote)                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-25 | Full launch prepared (15B.1), on `learning-13.2` after merging 11.1 (Case 2) and 14.1 (the mentor) and building 12.1 (Case 3). Machine-checked: lint, types, format, 145 Vitest files (2,490 tests), `evidence:check` (4 cases, 3 practice stories, the sandbox), `case:validate --strict`, coverage gates, `bundle:check` (largest page 185.7 KB), `security:bundle`, Playwright 74 of 74 (axe on every route and the sandbox terminal in all five colour themes, Cases 1–3 keyboard-only on desktop and 360 px, reduced motion, headers). `perf:vitals` (throttled phone, median of 3): `/` LCP 1164 ms, INP 80 ms, CLS 0.016; `/cases` 1492 ms, **336 ms**, 0; `/cases/case-01` 1408 ms, **224 ms**, 0. **INP is over budget on two pages** (see Known limits) |
| 2026-09-26 | UX.8 verification pass. Machine-checked: `bundle:check` (every page within budget, largest 183.0 KB), `security:bundle`, Playwright 87 of 87, including the new `visual.spec.ts` (16 screenshots, stable over repeated runs) and `viewport.spec.ts`; lint, types, format and 148 Vitest files (2,565 tests); axe now also runs on Case 1's Timeline, so every pane is checked in every case. `perf:vitals` (throttled phone, median of 3) on a quiet machine: `/` LCP 1240 ms, INP 16 ms, CLS 0; `/cases` 1276 ms, 88 ms, 0; `/cases/case-01` 1380 ms, 80 ms, 0. Run straight after a build and the e2e suite, the same code measured INP 256–536 ms: the worst interaction is always the first key, pressed while React is still hydrating, so it finishes hydration inside that keydown (Known limits). The 15B.1 build, measured alongside on the same quiet machine, gave 32–104 / 56–232 / 72–256 ms, so the UX prompts did not make it worse |
| —          | Screen reader pass                                                                                                                                                                                                                                                                                                                                                                        |
| —          | Playtests (P1–P3)                                                                                                                                                                                                                                                                                                                                                                         |

### Known limits of this release

- The app has one colour theme (dark) in v1, so "axe in light and dark" is one pass over the site, plus a pass over the sandbox terminal in each of its five colour themes (`tests/e2e/a11y.spec.ts`), which `tests/unit/terminal-themes.test.ts` also contrast-audits.
- Case 1's report questions can only point at the note's record: there is no ref for "this image's hash" (recorded in `src/content/cases/case-01.yaml`).
- **INP in `perf:vitals` depends on how busy the machine is** (2026-09-26: within budget on a quiet machine, 256–536 ms straight after a build). Written up first on 2026-09-25, when it was over budget (4× CPU). It was already over before today's work: the commit before 11.1 and 14.1 were merged measured `/cases` 256 ms and `/cases/case-01` 496 ms, against 160 and 192 ms at the 15A release. Two causes were found:
  1. **A key pressed before hydration has finished.** The script presses Tab as soon as the network is idle, and React then hydrates synchronously inside that keydown (up to about 460 ms on the case page). A `<Suspense>` boundary around the page content in `AppShell` now lets the page hydrate on its own, which took `/cases/case-01` from 496 to 224 ms. On `/cases` the key lands in the shell itself, so it still waits.
  2. **Opening the ⌘K palette** costs 140–220 ms throttled, nearly all of it in `dialog.showModal()`: the whole page's style is recalculated (a modal dialog makes everything else inert). Selector cost is small (Chrome's selector stats), and removing the `:has()` and forced-state rules made no reliable difference.
  Next steps, if a quiet-machine run and Speed Insights agree: hydrate less in the shell (render the palette's dialog body only once it is first opened), and consider a non-modal palette with its own focus trap.
- The sandbox hands over five log sources: no story action writes `vpn` yet (`src/content/cases/sandbox.yaml`).
- Case 3's two choice beats are report questions (the runner has no in-workspace choice yet), as Case 2's is. Case 3's header comment says so.

## 9. UI review checklist

For every new case and every screen that changes, and whenever Cases 2 and 3 change. It is `docs/UIUX.md` §4.3 (hierarchy) and §3.3 (colour) as questions. Walk it at 1440 × 900 and at 360 × 780 with reduced motion on, on the briefing, the workspace with each view open (Terminal, Objectives, Evidence, Timeline, Board), the report and the debrief. The pictures in `tests/e2e/visual.spec.ts-snapshots/` show what "right" looked like for Case 1 in UX.8 (2026-09-26); `docs/UIUX.md` §2.9 lists what was still open then.

**What a machine checks** (run these first; CI runs all but the last): `pnpm test:e2e` (axe on every screen, keyboard-only play, `viewport.spec.ts`, `visual.spec.ts` where the platform has baselines), `pnpm bundle:check`, `pnpm perf:vitals` on a quiet machine.

### Hierarchy (§4.3)

- [ ] **One primary button per screen, and it's the next step.** Count the solid amber buttons on each screen: at most one, and it's what a beginner should press now
- [ ] **The current task is the brightest thing after that button.** In the workspace the Now strip names the current objective; nothing else competes with it
- [ ] **Everything done collapses.** Ticked objectives fold to their tick and title; the report's answered questions don't grow
- [ ] **Destructive actions live in a menu with a confirm dialog.** Start the case again, Reset machine and anything that throws work away sit in a "⋯" menu, never beside the next step
- [ ] **Empty states follow 99 §Voice and carry one action.** What's empty, why, and one thing to do about it
- [ ] **The current objective, the prompt and the tab bar are in view** after a case's first commands, at both sizes, without the page scrolling (`viewport.spec.ts` checks Case 1)
- [ ] **SIMULATED once per view**: the shell's top bar, plus one per terminal

### Colour (§3.3)

- [ ] **Amber means "you can act on this."** Buttons, links, the selected tab and focus only; never decoration or status
- [ ] **Every status colour comes with an icon or a word.** MATCH ✓, MISMATCH ✕, blocker off ⚠, Supported / Needs evidence / Not yet
- [ ] **Warning orange is never a solid fill.** An outline, the dashed tape or an icon, so it can't be mistaken for an amber button
- [ ] **Reward violet is for moments**: the tick, the stamp, a found secret; never text you read
- [ ] **Tints are backgrounds only.** Text on `bg-accent/10` and friends is `text-primary`
- [ ] **One solid-amber block per screen, at most**, including selected toggles and empty-state buttons in panes

### When a screen changes on purpose

Update its baseline and look at it: `pnpm build && pnpm test:e2e tests/e2e/visual.spec.ts --update-snapshots`, then open the changed pictures in `tests/e2e/visual.spec.ts-snapshots/` and check them against this list before committing. The committed baselines were recorded on Windows; the spec skips on a platform without its own (CI's Linux runner). **Owner step:** record and commit Linux baselines once (on a Linux machine, or in Playwright's Docker image `mcr.microsoft.com/playwright`), so CI compares them too.
