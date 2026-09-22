# src/content/lessons

Learning Center lessons: one `.mdx` file per lesson, written for complete beginners (md-files/09-learning-center.md). The initial catalog covers the six-lesson Start Here track (its order is in `src/content/tracks.ts`), Linux, networking, the web, security fundamentals, and ethics and law. `start-terminal.mdx` is the house-style exemplar.

## Writing a lesson

The file name is the lesson's id: `net-ports.mdx` holds the lesson `net-ports`, served at `/learn/net-ports`. It starts with YAML frontmatter, validated by `LessonFrontmatterSchema` (`src/content/schemas/lesson.ts`):

```mdx
---
id: net-ports
title: Ports and services
topic: networking # foundations | linux | networking | web | crypto | forensics | blue-team
level: 1 # 0 first steps, 1 primer, 2 working knowledge, 3 deep dive
readingMinutes: 4 # 5 or less at levels 0 and 1
analogy: "A port is like a numbered door on a building; a service is whoever answers it."
summary: Numbered doors on a computer, and the programs that answer them. # optional, for cards
prerequisites: [net-ip-basics]
relatedMissions: [net-01]
relatedCommands: [netscan, webprobe]
glossaryTerms: [port, service, banner]
---

## The one-sentence version

Every computer has numbered doors called <Term id="port">ports</Term>.
```

House rules, enforced while the lesson compiles and in CI (`tests/unit/content-references.test.ts`):

- Sections are `##`, subsections `###`. No `#`: the page shows the title from the frontmatter. The headings build the "On this page" contents.
- No `import` or `export`. Use the lesson components:
  - `<Term id="…">words</Term>` the first time a glossary word appears.
  - `<Quiz question="…" options={[{ text, correct: true, explanation }, { text, explanation }]} />`: exactly one correct option, and an explanation on every option (the build fails without one).
  - `<MiniTerminal scenario="range-home" commands={["whoami"]} task="…" expect="whoami" success="…" />`: the real terminal on a practice machine from `src/content/mini-terminals.ts` (`range-home`, `range-permissions`, `range-logs`, `range-network`, `range-web`). Only suggest commands that work there.
  - `<PacketDiagram title="…" fields={[{ label, value, size, note }]} />` and `<Annotated title="…" code={`…`} notes={[{ line, label, text }]} />` break a message or some output down part by part. Copy output from a real run of the engine.
- Every lesson has the six sections in order: "The one-sentence version", "Why it matters in security", "How it actually works", "See it" (or "Try it"), "In practice", "Common misconceptions" (level 0 may leave out the third and sixth), with something to click, type or answer in the first two sections. `tests/unit/lesson-content.test.ts` checks this, the banned words, a `<Term>` for every frontmatter glossary term, and fictional names.
- Code fences use one of the languages in `src/features/learning/lessons/highlight.ts` (`console` for a terminal session, `shellscript`, `http`, `log`, …), or none for plain text. Add `title="Try this"` after the language for a caption.
- Every id in the frontmatter, and every `<Term id>` in the body, must exist. Levels 0 and 1 need an analogy and 5 minutes or less. Prerequisites can't loop.
- Keep examples fictional: `example.com` and `.example` domains, `10.x` and `192.168.x` addresses.

Never import here: React, features, or engine internals. Lessons are data.
