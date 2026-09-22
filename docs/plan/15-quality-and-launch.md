# 15 — Quality, sandbox, landing page and launch

**Part A: optional, right after wave 3 (ship "Case 1 only") · Part B: wave 6, alone · 1 week**
**Depends on:** A: 06. B: everything in waves 0–5
**Owns:** `src/app/(marketing)/**`, `src/app/(app)/sandbox/**`, `src/content/cases/sandbox.yaml`, `tests/e2e/**`, `docs/runbook.md`

## Goal

Ship it: every route accessible, fast and honest, a landing page that gets a visitor to a first win in under 2 minutes, a sandbox, and a Vercel deployment.

## Part A — first deploy with Case 1 only

You can ship after wave 3. "Case 1 only" is an honest disclaimer, just as Hacker Simulation's "Chapter 1 only" was.

### Prompt 15A.1

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md and docs/plan/15-quality-and-launch.md.
Prepare a "Case 1 only" release:
1. Landing page: one sentence on what this is, a "SIMULATED: every piece of evidence is made up"
   line, an "Open Case 1" button, a link to Hacker Simulation ("Candlewright's red team"), and the
   draft disclaimers from 16 plus "Cases 2 and 3 are still being written."
2. Hide cases 2 and 3 from /cases (a `released` flag in chapter.ts), not by deleting anything.
3. Run the whole quality list in 15 §Quality checklist and fix what fails.
4. Write docs/runbook.md: create the Vercel project (framework Next.js), environment variables (none
   needed; ANTHROPIC_API_KEY only if the mentor ships), the firewall rate-limit rule for /api/mentor/*
   copied from Hacker Simulation's runbook, rolling back, and the playtest kit.
Don't run vercel deploy yourself. List the owner steps at the end of your reply.
Commit when everything is green.
```

**Owner steps (you, in a browser):** create the Vercel project from the GitHub repo, set the production branch to `main`, require the "CI passed" check on `main`, add the firewall rule if the mentor is on.

## Part B — full launch

### Sandbox

`src/content/cases/sandbox.yaml`: a case with no objectives and no report, built by the generator from a mixed story (a disk with deleted and carved files, a memory image, all log sources), and a banner: "No goals here. Try any tool on anything." At `/sandbox`, with the cheat sheet from Hacker Simulation's sandbox adapted to the forensics tools.

### Quality checklist

- [ ] axe on every route, in light and dark themes, including every workspace pane open
- [ ] Keyboard-only: all three cases end to end (Playwright), no traps, visible focus everywhere
- [ ] Screen reader pass (NVDA or VoiceOver) through Case 1's first five minutes. A person, an hour
- [ ] Reduced motion respected everywhere (timeline zoom, celebrations)
- [ ] `pnpm bundle:check`: every page under 200 KB initial JS. Evidence, timeline, Evidence Browser, terminal and mentor all load on demand
- [ ] `pnpm security:bundle` and the security-header e2e pass. CSP without `unsafe-eval`
- [ ] Mobile at 360 px: every case can be finished
- [ ] Error and not-found states on every route
- [ ] `pnpm perf:vitals` on `/`, `/cases`, `/cases/case-01`: LCP < 2.5 s, INP < 200 ms, CLS < 0.1
- [ ] Coverage gates on `src/sim` (including `evidence/` and `tools/forensics/`) at Hacker Simulation's levels
- [ ] Playtest: three people with no security background play Case 1, one plays all three. If most need the third hint on a step, rewrite the step
- [ ] Banned words, name checks and world rules pass for every case, lesson, man page and prompt

### Prompt 15B.1

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md and
docs/plan/15-quality-and-launch.md (Part B).
1. Build the sandbox case and page as specified.
2. Release cases 2 and 3 in chapter.ts and update the landing page and disclaimers (drop "still being
   written").
3. Add Playwright specs for cases 2 and 3 keyboard-only, and run the whole quality checklist. Fix
   what fails; anything that needs a person (screen reader pass, playtests) goes in docs/runbook.md
   as an owner step with a checklist.
4. Update CLAUDE.md's project status and README.md.
Commit when everything that a machine can check is green. List the owner steps at the end.
```

## Done when

- [ ] Every machine-checkable item in the checklist passes in CI
- [ ] The owner steps are written down, and the site is live on Vercel
