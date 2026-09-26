# src/content

Declarative content as data, validated by schemas.

- `cases/` — one YAML file per case: the ground-truth story, the briefing, the objectives, the report and the debrief, checked by `cases/schema.ts` (see its README). `case-01.yaml` is written; `cases/chapter.ts` holds the chapter and the order its cases are played in.
- `evidence/` — the evidence each case's story builds, written by `pnpm evidence:build` and committed (see its README). Never edited by hand.

- `sandbox/` — the analyst workstation `ir-ws-01` that `/sandbox` runs (see its README).
- `lessons/` — the lessons and their format (see its README). The Foundations and Disk tracks are written (prompts 13.1 and 13.2).
- `practice/` — the stories behind the lessons' practice evidence, and the evidence `pnpm evidence:build` generates from them (see its README).
- `tracks.ts` — the Learning Center's tracks, in reading order.
- `references.ts` — the primary sources lessons cite (each section checked against the document), Hacker Simulation's lessons linked as prerequisites, and the dead-reference check.
- `themes/` — the terminal's colour themes, prompt styles and cursor styles, validated against `schemas/theme.ts` and contrast-audited by `tests/unit/terminal-themes.test.ts`. Vendored.
- `mini-terminals.ts` — the practice machines behind a lesson's `<MiniTerminal>`. Vendored, plus `ir-ws-practice` and `ir-ws-disk`, the analyst workstation with a practice examination and practice evidence attached.
- `schemas/` — the Zod schemas the lesson pipeline, glossary and themes need (`ids`, `lesson`, `lesson-components`, `glossary`, `theme`). Vendored.
- `cast.ts` — the story's speakers, with `MENTOR`. Vendored as-is: the speaker ids never change.
- `glossary.ts`, `topics.ts`, `lesson-graph.ts` — the glossary, lesson topics and levels, and the prerequisite graph. Vendored; file 13 extends the glossary.
- `voice.ts` — the banned words from `docs/plan/99-reference.md`, for content tests. Vendored.

Never import here: anything except `@/content` and `@/sim/types` (ESLint enforces this). Keep every name fictional and every address in a reserved range.
