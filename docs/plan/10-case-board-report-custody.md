# 10 — Case Board, report grading, Chain of Custody

**Wave 4 · parallel with 07, 08, 09 · 4–5 days**
**Depends on:** 05 (runner, pane registry, storage), 03 (report schema)
**Owns:** `src/features/case-board/**`, `src/features/cases/grading/**`, `src/features/cases/custody/**`, the report and debrief screens in `src/features/cases/components/report/**` and `.../debrief/**`

## Goal

Where findings live, how the report is checked, and the running record of what the player did. The rule that makes it forensics: **a finding only counts when it points at evidence.**

## Spec

### Case Board

- Cards: source badge, time (UTC + local when they differ), the output line or row it came from, the ref, and an editable note. Grouped by source, or sorted by time (toggle).
- Actions: edit note, remove (with undo), "Show in timeline", "Show in Evidence Browser", "Show in terminal".
- Empty state: "Pinned evidence shows up here. You haven't pinned anything yet. Type `pin` after a command, or press `p` on a row." (empty-state template in 99 §Voice).
- Pins are stored in the case run (05's storage), keyed by ref, so pinning the same thing twice merges.

### Report

A form built from the case's `report.questions`. Question types: `choice`, `timestamp` (pick from the timeline or type, ± tolerance), `evidence-pick`, `account`, `host`. Every question has a **"Supporting evidence"** picker that lists board pins only.

### Grading (pure, `src/features/cases/grading/`)

`gradeReport(caseSpec, resolvedEvidence, answers) → Finding[]` where each finding is:

- **supported**: answer correct **and** at least one cited pin's ref is in the question's resolved `acceptedEvidence`;
- **needs evidence**: answer correct, citations missing or not relevant. Copy: "That's right. Now show how you know: cite a pinned item that proves it.";
- **not yet**: answer not correct. Copy: the question's `explain` hint, never the answer.

The player can change answers and resubmit any number of times. Nothing is lost, and hints and the mentor never change the result. The debrief shows "**n of m findings supported**" and each finding's `explain` after it's supported. There is no numeric score.

### Chain of Custody

A pure selector over the engine event stream (`custodyLog(events)`), never a separate store: acquired, hashed (which algorithm, match or mismatch), original read (with or without blocker), recovered, carved, pinned, report submitted. Shown as a list during the case (an **Objectives** sub-tab) and in full on the debrief. The bonus "hashed before analysing" is a pure check on this log's order. Export as a plain-text custody record stamped "SIMULATED".

## Prompt 10.1

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md and
docs/plan/10-case-board-report-custody.md. Read the case runner and storage from file 05 first.

You own only the paths under "Owns" in 10, plus one registration line for the Board pane in
src/features/cases/workspace-panes.ts. Agents are working on 07, 08 and 09 at the same time.

1. The Case Board pane as specified, including undo, the cross-links, and the empty state.
2. gradeReport as a pure function with exhaustive unit tests: every question type, tolerance edges,
   correct-but-uncited, cited-but-wrong, cited-but-irrelevant, resubmission.
3. The report and debrief screens ("n of m findings supported", explains shown only after support).
4. custodyLog as a pure selector, the Objectives sub-tab, the debrief section, the plain-text export,
   and the "hashed before analysing" bonus check. Wire case-01's bonus to it.
5. Component tests, and extend the case-01 Playwright spec to submit a report with one uncited
   answer, see "needs evidence", cite a pin, resubmit and see 3 of 3.
Copy follows 99 §Voice. Finish with pnpm lint, pnpm typecheck, pnpm test and pnpm build green, then commit.
```

## Done when

- [x] A correct answer with no cited evidence is never marked supported
- [x] Resubmitting is always possible, and nothing about hints affects grading (tested)
- [x] The custody log on the debrief matches the event stream exactly (tested by replaying a playthrough)
