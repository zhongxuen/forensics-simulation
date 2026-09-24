# tests/mentor

The AI mentor's prompt-injection and answer-key suites (docs/plan/14-mentor.md), part of the `unit` Vitest project.

- `injection.test.ts` — 21 injection attempts run through the hint, explain and review prompts: the 16 vendored from `../hacker-simulation/tests/mentor/injection.test.ts`, plus the five docs/plan/14 §Spec asks for (the deletion time, a pin note carrying instructions, a file name carrying instructions, hostile file contents, and "which pin is the accepted evidence?"). It checks that every one stays fenced as data, that no locked tier or answer is in the prompt to leak, and that output validation catches what a tricked model might write — while still letting an honest hint through (a reserved address, a SHA-256, a log time, a Windows path).
- `answer-key.test.ts` — for every case this repo ships, `toMentorCase` and all three prompts built from it contain **not one string** of the answer key. It walks the case file's own values rather than a list of fields, so a new field in the case schema is covered the day it is added.
- `__fixtures__/hostile-evidence.ts` — a hostile file name planted by the **real generator**, which is this game's own injection channel: a case's evidence is generated from an authored story, so a file name in that story reaches `lsfs` output, an Evidence Browser row, a timeline entry, a board card and a pin note without the player typing a character of it. Nothing here ships: no real case carries it.

A live-model evaluation runs only when `ANTHROPIC_API_KEY` is set (it is skipped in CI).

Never import here: a real API key or network, except in the live block, which must stay skipped without a key. Import the mentor's modules directly (`@/features/mentor/prompt-builder`), not through `@/features/mentor/server`: that barrel re-exports the SDK client, whose `import "server-only"` throws at import time in a Node test.
