# src/sim/\_\_fixtures\_\_

Test-only data and helpers: a small fictional office network (`scenario.ts`), the golden command list (`golden-run.ts`), and helpers for engine tests. `golden/` holds the committed transcript and final state that `src/sim/golden.test.ts` compares byte for byte. If a change to the engine changes them on purpose, delete the files, rerun `pnpm test`, and review the diff.

Never import here from app code: nothing outside tests should depend on fixtures. Keep every name fictional and every address in a reserved range.
