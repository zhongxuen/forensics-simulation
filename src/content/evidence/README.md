# src/content/evidence

**Generated, not written.** One folder per case, built by `pnpm evidence:build` from that case's story in `src/content/cases`, and committed so the game never has to run the generator in a browser.

| File            | What it holds                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evidence.json` | The `EvidenceSet` the case hands the player: the disk images, the memory captures, the log records, the display zones, and the chain-of-custody forms      |
| `answers.json`  | The report's answer key, with each question's `acceptedEvidence` patterns already resolved into the artefact refs they matched when the evidence was built |

Never edit either by hand. Change the case's story instead and rebuild: `pnpm test:content` fails if what is committed here isn't what the stories build today, which is how a story edit that nobody rebuilt gets caught.

**Loading.** A case's evidence is a few hundred kilobytes — more than a whole page's JavaScript budget — so nothing imports it statically. `loadEvidence(caseId)` in `@/features/cases` uses a dynamic `import()`, which makes each case's evidence its own chunk, fetched when the workspace opens it and never before (`docs/plan/00-overview.md` §4, row 12). `pnpm bundle:check` is what keeps that honest.

The answer key ships with the case on purpose, the way a mission's answers do: nothing is recorded anywhere, so reading it only spoils your own case. What keeps the exercise honest is that every answer has to point at evidence.
