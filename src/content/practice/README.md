# src/content/practice

The evidence behind the lessons' practice terminals (`docs/plan/13-learning-center.md`: "a `<MiniTerminal>` on the real engine with a tiny generated evidence set, never a fake"). A story can hand over a drive, logs and a memory image, like a case.

| File                 | What it holds                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `stories.ts`         | One ground-truth story per practice drive, the same shape a case's story has, on Candlewright's own training kit                     |
| `<id>.evidence.json` | **Generated, not written.** The `EvidenceSet` the case generator plays that story into, built by `pnpm evidence:build` and committed |

The stories:

- `train-07` — the TRAIN-07 memory stick with the practice note on it, handed over with its hashes. Attached to `ir-ws-practice` for the Foundations lessons.
- `train-lt-01` — Candlewright's practice laptop (baseline `training-laptop-v1`): a week of a trainee's Documents folder, with a file changed and then read, a draft deleted and left alone, a note deleted and written over, and a PDF handout deleted, for carving. Attached to `ir-ws-disk` for the Disk lessons.
- `train-lt-02` — Candlewright's second practice laptop, on the morning of the team's hunt drill: a burst of sign-in guesses from the Range, a remote sign-in, a practice account added to Administrators, and a practice beacon named `svchost.exe` (wrong folder, wrong parent, unlinked, with an injected region and a check-in every minute) beside a .NET rota app whose runtime compiler leaves a harmless region of the same kind. Its drive, its `security` and `sysmon-lite` logs (the security log displays BST) and a memory image captured at 09:30 UTC. Attached to `ir-ws-drill` for the Memory, and Logs and timelines lessons.

A practice machine in `src/content/mini-terminals.ts` names its story in `evidence`; the learning feature loads the JSON with a dynamic `import()` (its own small chunk) and attaches it under `/dev/evidence` with the write-blockers on (`src/features/learning/practice/`).

Never edit the JSON by hand. Change the story and run `pnpm evidence:build`: `pnpm evidence:check` and `tests/content/practice-evidence.test.ts` fail when what is committed isn't what the stories build today. After a change, rerun the lessons' commands and update any output a lesson quotes (`pnpm test tests/unit/lesson-content.test.ts` runs every suggested command).

Never import here: anything except `@/content` and `@/sim/types`. Keep every name fictional: cast characters, Candlewright's training kit, `.example` domains.
