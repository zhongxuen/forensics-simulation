# src/features/learning

The Learning Center: the lesson pipeline, the interactive lesson components, the glossary UI, search, and the in-mission reference drawer (md-files/09-learning-center.md).

Two public entry points:

- `index.ts` — safe anywhere, client or server: `Term`, `GlossaryBrowser`, `GlossaryText`, `ManPage` (a command's manual page, straight from the engine), `ReferenceDrawer`, and `referenceSuggestions` / `commandOf`.
- `server.ts` — server only, because it reads files: `getLesson`, `listLessons`, `getPrerequisiteGraph`, `loadLessonCatalog`, `renderLesson`, `compileLessonBody` (it also collects the `<Term>` and `<TryIt>` ids for the dead-link check), `LessonArticle` (with an optional track position: "Start here, 3 of 6"), `TableOfContents`, and `buildSearchIndex`. Import it from server components, `generateStaticParams`, route handlers and tests, never from a `"use client"` module.

Inside:

- `lessons/` — `frontmatter.ts` (split and validate), `loader.ts` (read `src/content/lessons`, cached in production), `compile.ts` (MDX → component with `@mdx-js/mdx`), `remark-lesson.ts` (heading anchors and the table of contents, the house rules, `<Term>` collection), `highlight.ts` (Shiki with a CSS-variables theme, colours from `src/styles/code.css`), `lesson-components.tsx` (how lesson MDX renders), `lesson-article.tsx` (the lesson page).
- `components/` — the interactive lesson components (prompt 09.2). `lesson-mdx.tsx` holds what MDX sees: server components that validate their props (`src/content/schemas/lesson-components.ts`) and render the client views `quiz.tsx` (`<Quiz>`: an explanation for every option, "not quite" and a retry, never a fail screen), `mini-terminal.tsx` (`<MiniTerminal>`: the real terminal and engine on a machine from `src/content/mini-terminals.ts`, ticking when the expected command works; loaded through `mini-terminal-lazy.tsx`, React.lazy inside Suspense, so the server still renders it but its code isn't in the lesson's first download), `packet-diagram.tsx` (`<PacketDiagram>`) and `annotated.tsx` (`<Annotated>`). `<TryIt mission>` was not vendored (it read Hacker Simulation's mission catalog); the remark pass still collects its ids. All keyboard accessible and reduced-motion aware; `/styleguide` shows each one.
- `glossary/` — `term.tsx` and `term-popover.tsx` (the inline definition card: hover, focus, tap), `glossary-browser.tsx` (the `/learn/glossary` search and filter), `glossary-text.tsx` (backticks to code font).
- `search/build-index.ts` — `buildSearchIndex`: every lesson, glossary word and command manual page as a small entry, served as a static file by `src/app/search-index.json/route.ts` and searched in the browser with `searchIndex` (`src/lib/search.ts`) by the command palette and the drawer.
- `reference/` — `reference-drawer.tsx` (`ReferenceDrawer`: opens over the side of the mission workspace without trapping focus or touching the terminal or the run; suggests the mission's lessons and the last command's manual page and lessons; full pages open in a new tab, since leaving would end the run), `suggest.ts` (its pure suggestions), `man-page.tsx` (`ManPage`, also used by `/learn/commands`).

Never import here: another feature's internals.
