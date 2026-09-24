# src/content/cases

One YAML file per case, named after its id (`case-01.yaml`). A case file holds the **ground-truth story** — who did what, on which machine, at which instant — and everything the game wraps around it. Nobody writes evidence: `pnpm evidence:build` plays the story through the pure generator in `src/sim/evidence/generate` and writes the disk, memory and logs to `src/content/evidence/<case>/`, so the evidence can never disagree with the story that made it.

`schema.ts` is what checks a case. It follows `../hacker-simulation/src/content/schemas/mission.ts` field for field wherever the two mean the same thing, so anyone who has written a mission can write a case. Run `pnpm test:content` to see an author's-eye list of everything wrong with a file.

A file starting with `_` is a **fixture**: it exercises the pipeline and is never offered to a player. `_fixture.yaml` is the one, and it is the shortest full example of every part of the format.

`chapter.ts` is the other file here that is not a case: the chapter's title, the two lines that frame it, and the **order its cases are played in**. Everything that needs to know which case comes first reads it from there — the landing page's button, the app shell's "Start here", the case list — so moving a case in the chapter moves it everywhere. `tests/content/case-chapter.test.ts` checks its ids against this folder.

## What a case file holds

| Part                                | What it is                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `version`, `title`, `seed`    | The id matches the file name. Bump `version` when objectives or report questions change; saved runs key on it. The seed decides every made-up detail and all the background activity                                                                                                                                            |
| `client`                            | Who asked, who signed, and the letter itself — which the player can read on the workstation. Every case has one (`docs/plan/99-reference.md`, rule 1)                                                                                                                                                                           |
| `hook`, `learningGoals`, `briefing` | The line that makes a beginner click, 2 to 4 things they will learn, and the situation, their role and the **authorization**: who signed, and exactly what may be examined                                                                                                                                                      |
| `machines`                          | Each machine's id, kind, `baseline` (a clean template), time `zone`, optional address and the accounts on it. The analyst's workstation is a machine too, and is never evidence                                                                                                                                                 |
| `story`                             | The ground truth, as a list of **actions**. Times are written with their zone. This is the only place the truth lives                                                                                                                                                                                                           |
| `noise`                             | A `profile` and a `density` of ordinary activity around the story. Turning it up makes a case harder without touching the story                                                                                                                                                                                                 |
| `evidence`                          | What the client handed over: which `disks`, which `logs`, which machines' `memory`, and any source that **displays** local time (`zones`)                                                                                                                                                                                       |
| `beats`                             | The character lines that play during the case: on `start`, on `complete`, on an objective, or on a report question. Speakers come from `cast.ts` and are never renamed                                                                                                                                                          |
| `objectives`, `hints`               | 3 to 6 main steps, each with a `why` and a `success` line and a declarative `check` (`commandRun`, `pinned`, `reported`, `answer`, `custody` with a `rule` such as `hashed-before-analysing`, or `all` / `any` of them). Bonuses and secrets get a playful 1-to-3-word `name`. Three hints each; **the first names no command** |
| `report`                            | The questions that close the case. Each has an `answer`, an `explain`, and `acceptedEvidence`: the evidence an answer has to point at                                                                                                                                                                                           |
| `debrief`                           | What they did, one past-tense line per learning goal, the `ethicsNote`, the `defensiveTakeaway` and a one-line `nextTease`                                                                                                                                                                                                      |

## Story actions

An action says `at`, `actor`, `on` and `do`, plus its own fields — written flat, or grouped under `with:`, whichever reads better:

```yaml
- id: docket-deleted # optional, so a report question can point back at it
  at: "2026-04-11T21:51:07Z" # always with a zone, always in quotes
  actor: attacker # or user:dana, system, analyst
  on: qf-lt-03
  do: delete-file
  path: 'C:\Users\mara\Documents\docket-4471.txt'
```

The actions are `logon`, `logoff`, `failed-logon`, `create-account`, `add-to-group`, `create-file`, `modify-file`, `read-file`, `delete-file`, `overwrite-clusters`, `usb-insert`, `copy-to-usb`, `browse`, `download`, `run-process`, `inject`, `connect`, `firewall-allow`, `firewall-block`, `dns-query`, `web-request`, `clock-skew`, `capture-memory` and `hand-over`. Each one is a file in `src/sim/evidence/generate/actions/`, with a comment saying what it leaves behind and why it matters, and a test beside it.

Two things the generator holds a story to, both of which stop the build:

- **Everything has to exist before it is used.** An account has to be on the machine (or made by `create-account`) before it can sign in; a file has to be there before it can be read, copied or deleted.
- **A disk can't change after it is handed over.** Move the `hand-over` to after everything that touches that machine. (The player breaking that hash by reading the original without a write-blocker is Case 1's whole lesson — that's the game, not the story.)

## Accepted evidence

A report question names the evidence an answer has to point at by what it _is_, and the build turns that into the concrete artefact refs it matches today:

```yaml
acceptedEvidence:
  - "disk:qf-lt-03:mft/*docket-4471*" # the file record, by part of its path
  - "log:security/where eventId=4624 and LogonType=10" # the remote sign-in
  - "mem:qf-srv-01-mem:conn/*203.0.113.*" # the connection, by either address
```

`*` is any run of characters and matching ignores case. A pattern that matches **nothing** stops the build, which is the whole point: a question whose evidence has moved is exactly the drift this catches.

## Writing a case

1. `pnpm case:new <id>` — scaffolds a case, its playthrough and its evidence. What it writes already validates and plays to the end, with every piece of copy marked TODO.
2. Write the story first, and only then the objectives and the report. The story is what everything else is checked against.
3. `pnpm evidence:build` — plays it, writes the evidence, and tells you what it couldn't do. Run it again after every story edit.
4. `pnpm case:play <id>` — plays the case's playthrough and prints the transcript. Add `--run "<command>"` to try something out instead.
5. `pnpm case:validate <id>` — the schema, the story, the accepted evidence, the lesson links, the banned words, the committed evidence and the playthrough, with readable errors.
6. `pnpm test:content` — the same checks as a test suite, plus consistency, determinism and the world rules.
7. Work through the authoring checklist in `docs/plan/99-reference.md`.
8. Add the case to `chapter.ts` if it isn't there, so it appears in the list and in the right place.

Two things worth knowing before the first run, both learned writing Case 1:

- **A case has to hand over every log source its story writes to.** Background activity browses and looks names up, so an `office-day` profile writes to `dns` whether or not the report asks about it. `pnpm evidence:build` says which sources were dropped, and `tests/content/case-consistency.test.ts` fails on them.
- **A report answer points at an artefact, and an artefact is a record, a log line or something in memory.** There is no ref for an image's hash, so "my copy matched the form" cannot be cited directly; Case 1's header comment says how it works around that.

## Playthroughs

Every case has one, in `playthroughs/<id>.yaml`: the scripted run that proves the case can be finished with the tools the game has. It is not a script for the player — it is the proof, run by `pnpm case:play`, `pnpm case:validate` and CI.

```yaml
case: case-02
steps:
  - run: cat letter.txt # type a command, exactly as a player would
    ticks: [read-the-letter] # and check what it ticks
  - pin: "log:security/where eventId=4624" # put evidence on the board from a view
  - report: when-deleted # answer a report question
    answer: "2026-04-11T19:42:03Z"
    cite: ["disk:qf-lt-07:mft/*inv-0412*"] # the pinned evidence it points at
    verdict: supported # supported | needs-evidence | not-yet
expect:
  complete: true # every main objective ticked
  supported: true # every report finding points at evidence
```

Commands go through the same parser, engine and tool registry as the browser, so a playthrough that finishes here finishes in the app. A `pin:` step takes an evidence **pattern**, not a record number, so it keeps working when the story moves.

## Names

Every new name — a person, a company, a product, a machine — is searched before it is used, and recorded here. Only `.example` domains, and only reserved addresses (RFC 5737's `192.0.2.0/24`, `198.51.100.0/24` and `203.0.113.0/24`, or a private range). The schema refuses anything else.

| Name             | Checked    | What it is, and what the search found                                                                                                                                                                                          |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quillfen Freight | 2026-09-22 | The client. No organisation of that name was found (`docs/plan/00-overview.md` §4, row 1)                                                                                                                                      |
| Pellmoor         | 2026-09-23 | The drive maker printed on the evidence bag, in `baselines/`. No company or brand of that name was found; the nearest are Pella and Pelmorex                                                                                   |
| Wrenfold         | 2026-09-23 | The memory-stick maker a `usb-insert` gives a drive. No company or brand of that name was found; the nearest are Renfold and Wren Kitchens                                                                                     |
| Delia Quillfen   | 2026-09-23 | Quillfen Freight's owner, who signs Case 1's letter and never speaks. Searched as a full name: no person of that name was found, and the nearest was an unrelated Delia Quilez. The surname is the yard's own, already cleared |
| Gus Thimblegate  | 2026-09-23 | The yard's IT contractor, who signs Case 1's handover form and never speaks. "Thimblegate" returned no organisation and no notable person, only residential street names in Georgia and Kentucky                               |
| `mara`           | —          | The yard office account in `_fixture.yaml` and `case-01.yaml`. A first name with no surname, standing for nobody. The cast, who do have names, is in `cast.ts`                                                                 |

Two names were searched for Case 1 and dropped: **Brindlecote** (a real Brindle IT Solutions exists, and an IT contractor is exactly what the name was for) and **Speltham** (Speltham Limited is a real UK clothing company). **Gorsewick** was dropped too: Gorsewick Hall is the setting of a published mystery series.

Never import here: anything except `@/content` and `@/sim/types` (ESLint enforces it).
