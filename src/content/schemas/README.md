# src/content/schemas

Zod schemas that validate everything in `src/content`. A malformed mission must fail a test, never ship.

- `ids.ts` — the id and command-name formats shared by every schema.
- `lesson.ts` — `LessonFrontmatterSchema`: a lesson's frontmatter, strict (unknown keys fail), with the beginner rules (levels 0–1 need an analogy and 5 minutes or less).
- `glossary.ts` — `GlossaryEntrySchema` and `GlossarySchema`.
- `mission.ts` — `MissionSchema` and its types (`Mission`, `Objective`, `ObjectiveCheck`, `StoryBeat`, `FilePredicate`, `ScenarioDefinition`), strict everywhere with "did you mean" for typos. It requires the ethics fields (`briefing.authorization`, `debrief.ethicsNote`, `debrief.defensiveTakeaway`) and the beginner fields (`hook`, 2–4 `learningGoals`, a `why` and `success` on every objective, 3–6 main objectives, a time cap per difficulty). `parseMission` lists problems as `path: message` for authors; `toScenarioSpec` turns a mission's scenario into the engine's `ScenarioSpec`; `normalizeAnswer` is how answers are compared. Bonus objectives and secrets carry a playful `name` (1–3 words), and main objectives may not.
- `mission-helpers.ts` — the Zod-free pieces the browser needs at runtime (`MISSION_DIFFICULTIES`, `normalizeAnswer`, `toScenarioSpec`), re-exported by `mission.ts`. Browser code imports them from here, so the full Zod build (about 90 KB gzipped, phase 11) stays out of the mission pages.
- `theme.ts` — the terminal themes' and styles' schemas. `src/content/themes` only imports its types (it runs in the browser on every page); `tests/unit/terminal-themes.test.ts` validates every theme and style against it.
- `lesson-components.ts` — the props of the interactive lesson components (`QuizSchema`: exactly one correct option and an explanation on every option; `MiniTerminalSchema`; `PacketDiagramSchema`; `AnnotatedSchema`), and `parseComponentProps`, which throws a readable list of problems while a lesson renders.
- `playthrough.ts` — `PlaythroughSchema`: a scripted run of a mission (`run`, `answer` + `objective`, `reset` steps, optional `ticks` and `accepted` checks, and an `expect` block), for `pnpm mission:play` and CI.

Rules that span the whole catalog (an id points at something real, prerequisites don't loop) live in `src/content/references.ts` and `src/content/lesson-graph.ts`, and run in tests. Whether a mission's scenario builds is checked by the mission loader, which runs the engine.

Never import here: anything except `@/content` and `@/sim/types`.
