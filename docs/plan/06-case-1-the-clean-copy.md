# 06 — Case 1: The Clean Copy

**Wave 3 · alone · 3–5 days · Milestone: first playable case**
**Depends on:** 03, 04, 05
**Owns:** `src/content/cases/case-01.yaml`, `src/content/cases/playthroughs/case-01.yaml`, `src/content/evidence/case-01/**`, `src/content/cases/chapter.ts`, the landing page copy

## Goal

A ~15-minute first case that a complete beginner finishes, where the first objective ticks in under 2 minutes, and which teaches acquisition, write-blocking, hashing and chain of custody (the FTK Imager workflow).

## Story (ground truth)

Quillfen Freight's owner found the yard office laptop `qf-lt-03` switched on and unlocked on a Monday morning, with a text file on the desktop signed `— HL`: "The door was open." They've asked Candlewright to find out what happened, and signed the letter. Before anyone can look, the evidence has to be copied properly, because a copy you can't prove is identical isn't evidence.

- Idris Fenwick (defender) leads. Noor Halvorsen is the mentor. Kit is eager to open the laptop right away.
- The laptop arrives in a bag with a **handover form**: who handed it over, when, and the SHA-256 the yard's IT contractor took on site (readable at `/cases/case-01/handover.txt`).
- This case is about **the copy**, not the break-in. Its closing line sets up Case 2: the note's file record shows it was created at 19:44 UTC on the Saturday before (2026-04-11).

## Objectives (3–5 main)

1. **Read the handover form.** Ticks on `cat handover.txt`. (Under 2 minutes: the briefing tells you where it is.)
2. **Turn on the write-blocker** for `/dev/evidence/qf-lt-03`.
3. **Make an image** with `acquire` into `/cases/case-01/images/`.
4. **Prove the copy is identical:** `hashsum --verify` against the handover SHA-256, then pin the MATCH line.
5. **Find the note in the image** (`lsfs`, `inode`), and pin its record. Its created time goes in the report.

**Bonus:** hashed before opening anything (from the custody log in 10: if 10 hasn't merged, detect the event order directly). **Secret:** "Belt and braces": also verified MD5.

**Wrong turn (choice beat):** Kit suggests "just having a quick look" at the original before imaging. If the player reads the original with the blocker off, the access times change, the hash no longer matches the form, and Noor explains why in plain words (real consequence: a defence lawyer can argue the evidence was changed). The player can **Reset machine** and do it the right way. No fail screen, nothing lost except that run.

## Report (3 questions)

- Is your image identical to what the yard handed over? (choice) → cite the MATCH line.
- Which hash did you verify it with, and why that one? (choice: SHA-256 is the one on the form) → cite the MATCH line.
- When was the note created? (timestamp, ±60 s) → cite the note's record.

## Teaching points and lessons

`concepts`: Hacker Simulation's `forensics-evidence-care` (linked), and this game's `foundations-order-of-volatility`, `foundations-chain-of-custody`, `foundations-hashing-for-evidence` (file 13; link lesson ids even if 13 is still in progress, `case:validate` checks them once it merges). Defensive takeaway for the client: lock screens and a written rule for what to do when you find a machine like this (don't turn it off, don't use it, call someone).

## Prompt 06.1 — author Case 1

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md (especially §Story world,
§Voice and §Authoring checklist) and docs/plan/06-case-1-the-clean-copy.md. Read
../hacker-simulation/src/content/missions/intro-01.yaml and its playthrough for tone and structure.

1. Run pnpm case:new case-01 and fill it in from 06 §Story, §Objectives, §Report, §Teaching points.
   Every cast line uses a speaker id from src/content/cast.ts. Quillfen's owner never speaks (no
   speaker id): their voice arrives as the signed letter and the handover form. Choose the owner's
   name and the IT contractor's name, search the web for each, and record the check in
   src/content/cases/README.md the way ../hacker-simulation records its name checks. Don't use a
   name that belongs to a real organisation or a notable person.
2. Write the ground-truth story so the generator produces the laptop, the note, the handover hash
   and a light office-day noise profile. Run pnpm evidence:build.
3. Write the playthrough with the wrong turn (blocker off, mismatch, reset), every bonus and secret,
   and all report answers supported.
4. Add src/content/cases/chapter.ts (the chapter's title, opening and closing lines, and case order)
   and point the landing page's "Open Case 1" button at it.
5. Run pnpm case:validate case-01 and pnpm case:play case-01, then read the transcript out loud
   against the authoring checklist. Fix anything a complete beginner wouldn't follow.
Finish with pnpm lint, pnpm typecheck, pnpm test and pnpm build green, then commit.
```

## Prompt 06.2 — first-five-minutes e2e

```text
Read docs/plan/06-case-1-the-clean-copy.md. Add tests/e2e/case-01.spec.ts: from / to the first
objective ticking in under 2 minutes of simulated input, then the whole case keyboard-only, including
the wrong turn and reset, ending on the debrief with 3 of 3 findings supported. axe on every screen
it passes through. Run against a production build. Commit when green.
```

## Done when

- [ ] `pnpm case:play case-01` completes with the wrong turn, every bonus and secret
- [ ] Playwright: first tick in under 2 minutes, full case keyboard-only
- [ ] A person with no security background finishes it without the third hint (playtest, see 15)
