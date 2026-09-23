# src/content/lessons

Learning Center lessons: one `.mdx` file per lesson, written for complete beginners and going deeper than Hacker Simulation's forensics lessons, which they link to instead of repeating (`docs/plan/13-learning-center.md`). The tracks and their reading order are in `src/content/tracks.ts`. The Foundations track is written; Disk, Memory, and Logs and timelines follow in prompts 13.2 and 13.3.

## Writing a lesson

The file name is the lesson's id: `foundations-chain-of-custody.mdx` holds the lesson `foundations-chain-of-custody`, served at `/learn/foundations-chain-of-custody`. It starts with YAML frontmatter, validated by `LessonFrontmatterSchema` (`src/content/schemas/lesson.ts`):

```mdx
---
id: foundations-chain-of-custody
title: Who had the evidence, and when
topic: forensics # foundations | linux | networking | web | crypto | forensics | blue-team
level: 2 # 0 first steps, 1 primer, 2 working knowledge, 3 deep dive
readingMinutes: 7 # 5 or less at levels 0 and 1
analogy: "A parcel's tracking history: …" # required at levels 0 and 1
summary: A written record of every hand the evidence passed through. # optional, for cards
prerequisites: [foundations-what-forensics-is]
externalPrerequisites: [forensics-evidence-care] # Hacker Simulation lessons: "Start here if this is new"
relatedCommands: [grep, cat]
glossaryTerms: [chain-of-custody, custody-log]
cites: [nist-sp-800-86-s3-1-2, nist-ir-8387-s3-2] # at least one, from src/content/references.ts
---
```

- `externalPrerequisites` takes only the six Hacker Simulation lessons listed in `EXTERNAL_LESSONS` (`src/content/references.ts`). The lesson page shows them as "Start here if this is new", linking to `https://hacker-simulation.vercel.app/learn/<id>`.
- `cites` names primary sources by id from `CITATIONS` in `src/content/references.ts`. Every lesson cites at least one, and names each source in its text ("RFC 3227 (§2.1)"). Before adding a citation, open the document and check the section number and what it says; record the date in `checked`. The lesson page lists them under "Sources".

House rules, enforced while the lesson compiles and in CI (`tests/unit/content-references.test.ts`, `tests/unit/lesson-content.test.ts`):

- Sections are `##`, subsections `###`. No `#`: the page shows the title from the frontmatter.
- Six sections in order: "The one-sentence version", "Why it matters in security", "How it actually works", "See it" (or "Try it"), "In practice", "Common misconceptions", with something to click, type or answer in the first two (`docs/plan/99-reference.md`, "Lesson structure").
- No `import` or `export`. Use the lesson components:
  - `<Term id="…">words</Term>` the first time a glossary word appears. Every `glossaryTerms` id needs one.
  - `<Quiz question="…" options={[{ text, correct: true, explanation }, { text, explanation }]} />`: exactly one correct option, and an explanation on every option. Every lesson has one.
  - `<MiniTerminal scenario="ir-ws-practice" commands={["cat letter.txt"]} task="…" expect="cat" success="…" />` in the "See it" section: the real terminal on a practice machine from `src/content/mini-terminals.ts`. `ir-ws-practice` is the analyst workstation with a practice examination on it (a letter, a custody log, a handover form, recorded hashes and two copies of a note). Every suggested command is run in CI and must succeed. Until file 04 lands, lessons use the workstation's commands only; where a lesson wants `acquire` or `hashsum`, leave a `{/* TODO(04): … */}` comment.
  - `<Annotated>` and `<PacketDiagram>` break output or a message down part by part. Copy output from a real run of the engine.
- "In practice" links the case where the player meets the idea: `[Case 1, The Clean Copy](/cases/case-01)`.
- The voice rules in `docs/plan/99-reference.md`: second person, short sentences, plain words first, and none of the banned words in `src/content/voice.ts`.
- Code fences use one of the languages in `src/features/learning/lessons/highlight.ts`, or none for plain text.
- Every id in the frontmatter, and every `<Term id>` in the body, must exist. Prerequisites can't loop.
- Keep everything fictional: cast characters and world-fact places only, `.example` domains, `10.x` and `192.168.x` addresses and the RFC 5737 documentation ranges.

Never import here: React, features, or engine internals. Lessons are data.
