# 16 — Portfolio entry and cross-links

**Wave 7 · alone · half a day**
**Depends on:** 15 (a live URL)
**Runs in:** `../zhongxuen-portfolio` (16.1) and `../hacker-simulation` (16.2, optional), **not** this repo

## Goal

The project shows up on the portfolio with an accurate card that backs up the Autopsy, Volatility and FTK Imager skills, and the two Candlewright sites link to each other.

## The entry (draft)

- **slug:** `candlewright-incident-room`
- **technologies:** Next.js, TypeScript, React, Tailwind CSS, Zod, Vitest, Playwright (+ Claude API if the mentor shipped)
- **skills this backs up:** Autopsy, Volatility Workbench, FTK Imager (already in `data/skills.ts`)
- **keyFeatures (draft):** three cases generated from written stories and tested to be solvable · an Autopsy-style evidence browser, a Volatility-style memory toolkit and an FTK-style acquire-and-verify workflow · a cross-linked super-timeline · a report that only counts findings backed by evidence · a chain-of-custody log built from what you did
- **disclaimers (draft):**
  - "Every disk image, memory dump and log is made up and generated from a written story. Nothing here parses a real image or real memory, and the tools have invented names. Each tool's manual names the real tool it imitates."
  - "It teaches the investigator's workflow, not the internals of any one commercial tool, and it isn't preparation for a certification."
  - "No accounts and no database: your cases are saved in your own browser, and you can export or clear them."

## Prompt 16.1 — in the portfolio repo

```text
Open this session in ../zhongxuen-portfolio. Read its CLAUDE.md/AGENTS.md first, then
../forensics-simulation/docs/plan/16-portfolio-entry.md and ../forensics-simulation/README.md.
1. Add the Project entry to data/projects.ts (or through /admin if that's the house way), using the
   draft in 16, the live URL and the GitHub repo. Match the shape and tone of the Hacker Simulation
   entry.
2. Add a screenshot of the workspace (Case 1, Evidence Browser open) to public/images/projects/.
3. Check data/skills.ts: Autopsy, Volatility Workbench and FTK Imager should now be linked to this
   project if the skills data supports that.
4. Update app/sitemap.ts if slugs are listed by hand.
5. If the "series" grouping from docs/README.md §4 exists, don't add this project to the visualizer
   series; it's a Candlewright game.
Run the portfolio's lint, typecheck, tests and build, then commit on a branch and show me the diff.
```

## Prompt 16.2 — in Hacker Simulation (optional)

```text
Open this session in ../hacker-simulation. Read its CLAUDE.md and md-files/remaining.md.
Add a link to the sibling site "Candlewright: Incident Room" (the blue team's cases) in the places its
own docs say cross-links go: the landing page footer, and the debrief of forensics-01 as a "try next"
outside link, if the schema allows outside links (if it doesn't, stop and tell me rather than change
the schema). Follow its voice rules and banned-word check. Run its tests and build, then commit on a
branch.
```

## Done when

- [ ] The portfolio card is live with a screenshot, repo stats and honest disclaimers
- [ ] The two sites link to each other
