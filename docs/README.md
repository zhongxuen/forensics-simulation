# Portfolio Expansion — Index and Shared Decisions

Written: 2026-09-22
Status: **[planned]** — nothing here is built yet.

Five new projects, each planned in its own file:

| # | Plan | Fills | Size | Suggested order |
|---|---|---|---|---|
| 1 | [plan/00-overview.md](plan/00-overview.md) (split into files 01–16) | Autopsy, Volatility, FTK Imager are listed as skills but no project uses them | L | 1st |
| 2 | [crypto-visualizer-plan.md](crypto-visualizer-plan.md) | Internet Visualizer's "no cryptography in the TLS layer" disclaimer | M | 2nd |
| 3 | [os-visualizer-plan.md](os-visualizer-plan.md) | Operating Systems course | M | 3rd |
| 4 | [compiler-visualizer-plan.md](compiler-visualizer-plan.md) | AI Code Visualizer's "does not execute your code" disclaimer | L | 4th |
| 5 | [database-internals-visualizer-plan.md](database-internals-visualizer-plan.md) | Databases course | L | 5th |

Why this order: the forensics game fills the most visible gap on the site. Skills that no project backs up weaken the skills section. Crypto is the smallest project and links directly to the Internet Visualizer the site already features. The other three follow the likely order of your courses and can move around to match your semester.

---

## 1. New website or part of the portfolio? → **A new website for each project**

Each project gets **its own repo and its own Vercel deployment**. The portfolio only gets a new entry in `data/projects.ts`.

Reasons:

1. **It matches the existing projects.** Every interactive project (Internet Visualizer, Hacker Simulation, AI Code Visualizer, JobNow, JARVIS) already works this way: separate repo, `liveUrl`, `githubUrl`/`githubRepo`. The GitHub adapter adds stars, language and last-updated date to each card from its repo. A project inside the portfolio repo would get none of that.
2. **The portfolio stays small.** The portfolio is statically generated and has a performance budget. A forensics game with evidence files, or a compiler with an editor, would make its bundle and build much larger, and every portfolio visitor would pay for it.
3. **Each project is separate proof of your skills.** Four repos, each with its own README, tests and commit history, show more than four folders inside one repo.
4. **The projects can't break each other.** A bad deploy of one project can't take the portfolio down, and the reverse is also true.

The forensics game is a slightly different case, because it could be **Chapter 2 of Hacker Simulation**. Recommendation: **build it as a separate sibling site, and share the Hacker Simulation world** (Candlewright Security, the same cast, the same look). Reasons:

- It's a different kind of game (investigation, not intrusion), and it needs views Hacker Simulation doesn't have (a file tree for the disk image, a timeline, a case board).
- As its own project it gets its own card, which is what backs up the Autopsy, Volatility and FTK Imager skills.
- Hacker Simulation's disclaimers say "Chapter 1 only… later chapters are not written". A sibling site doesn't contradict that.
- The two sites can link to each other ("Candlewright's blue team"), so they read as one universe.

### Reusing code between repos

Don't try to share a package between repos. **Copy the pieces you need into the new repo** (for example `src/sim/core` from Hacker Simulation, or the timeline and event kernel from Internet Visualizer), and add a `VENDORED.md` saying where each piece came from and at which commit. Shared packages across repos cost you publishing, versioning and cross-repo breakage, which isn't worth it for one developer. If three or more repos end up with the same copied kernel, turn it into a package then.

---

## 2. Data storage → **No database for any of these five**

None of these projects needs a server-side database:

| Need | Where it goes |
|---|---|
| Case files, evidence, scenarios, lessons | Static files in the repo (JSON/YAML/MDX), validated by Zod at build time |
| Player progress, settings, finished cases | `localStorage`, behind a versioned schema (`{ v: 1, ... }`) with a migration function. (Hacker Simulation stores settings only and keeps no progress; the forensics game deliberately saves case runs, see [plan/00-overview.md](plan/00-overview.md) §4) |
| Sharing a specific state ("look at this B-tree") | Encode the state in the URL (`?s=<base64url>`). No storage needed |
| Moving progress to another device | "Export progress" produces a short code or JSON file, and "Import" reads it back. No accounts needed |
| Usage numbers | `@vercel/analytics`, which is already in every project |
| AI mentor (optional, forensics game only) | A server route that calls the Claude API. Stateless, no storage, same approach as Hacker Simulation's mentor |

**Firebase:** you don't need it. The only feature that would need it is a **global leaderboard** for the forensics game. That also needs sign-in or anti-cheat, because any score written from the browser can be forged. It adds cost and maintenance and does little for a portfolio. If you want it later, use Firestore on the free Spark plan, anonymous auth, and security rules that only allow writes with a server-verified signature. Treat it as its own phase-2 task, not part of the core.

This also takes Supabase's free-tier limit off the table. Nothing here needs a Supabase project.

---

## 3. How all five are built

Every plan follows the same structure, because it's what makes Internet Visualizer and Hacker Simulation good:

1. **The core is pure and deterministic.** A framework-free TypeScript core takes an input and returns an ordered list of typed events. It has no React, no DOM, no `Date.now()` and no `Math.random()`. ESLint boundary rules enforce this, as they already do in both existing projects.
2. **The UI only renders the event stream.** One shared timeline (play / pause / step / step back / scrub / speed) drives every module.
3. **Accuracy is tested, not just claimed.** Each project has a citations file (standard, RFC, textbook section) and a test that fails if a citation is missing. A determinism test runs every scenario twice and checks that both runs are deep-equal. Where a real reference implementation exists, a **differential test** compares the simulation against it (for example, the AES simulation against WebCrypto).
4. **Honest disclaimers.** Each plan lists what the project deliberately leaves out, in the same voice as the existing `disclaimers[]` fields.
5. **The same quality checks.** axe on every route, keyboard-only operation, reduced motion respected, a per-page JS budget, Vitest + Playwright.

Default stack for each repo: Next.js (same major version as the portfolio, and read `node_modules/next/dist/docs/` first as `AGENTS.md` says), TypeScript, Tailwind CSS v4, Zod, Vitest, Playwright. Add Zustand, React Flow or Monaco only where a plan says so (Hacker Simulation manages state with pure reducers and hooks, and the forensics game follows it).

---

## 4. Changes to the portfolio repo (for each shipped project)

1. Add a `Project` entry through `/admin` or by hand in `data/projects.ts`: slug, description, longDescription, technologies, githubUrl/githubRepo, liveUrl, keyFeatures, disclaimers, order.
2. Add a screenshot to `public/images/projects/`.
3. Add any new skills to `data/skills.ts`.
4. **Optional "series" grouping for the visualizers.** Add `series?: "visualizers"` to `types/project.ts` and show a small "Part of the Visualizer Series" label on the card. Since `data/projects.ts` is re-emitted by `lib/admin/serializeProjects.ts`, the new field also has to go into the serializer and the admin project form, or the next admin save will drop it.
5. Update `app/sitemap.ts` if project slugs are listed there by hand.
