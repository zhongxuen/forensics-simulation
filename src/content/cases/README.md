# src/content/cases

One YAML file per case, named after its id (`case-01.yaml`). A case file holds the **ground-truth story** — who did what, on which machine, at which instant — and everything the game wraps around it. Nobody writes evidence: `pnpm evidence:build` plays the story through the pure generator in `src/sim/evidence/generate` and writes the disk, memory and logs to `src/content/evidence/<case>/`, so the evidence can never disagree with the story that made it.

`schema.ts` is what checks a case. It follows `../hacker-simulation/src/content/schemas/mission.ts` field for field wherever the two mean the same thing, so anyone who has written a mission can write a case. Run `pnpm test:content` to see an author's-eye list of everything wrong with a file.

A file starting with `_` is a **fixture**: it exercises the pipeline and is never offered to a player. `_fixture.yaml` is the one, and it is the shortest full example of every part of the format.

## What a case file holds

| Part                                | What it is                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `version`, `title`, `seed`    | The id matches the file name. Bump `version` when objectives or report questions change; saved runs key on it. The seed decides every made-up detail and all the background activity        |
| `client`                            | Who asked, who signed, and the letter itself — which the player can read on the workstation. Every case has one (`docs/plan/99-reference.md`, rule 1)                                       |
| `hook`, `learningGoals`, `briefing` | The line that makes a beginner click, 2 to 4 things they will learn, and the situation, their role and the **authorization**: who signed, and exactly what may be examined                  |
| `machines`                          | Each machine's id, kind, `baseline` (a clean template), time `zone`, optional address and the accounts on it. The analyst's workstation is a machine too, and is never evidence             |
| `story`                             | The ground truth, as a list of **actions**. Times are written with their zone. This is the only place the truth lives                                                                       |
| `noise`                             | A `profile` and a `density` of ordinary activity around the story. Turning it up makes a case harder without touching the story                                                             |
| `evidence`                          | What the client handed over: which `disks`, which `logs`, which machines' `memory`, and any source that **displays** local time (`zones`)                                                   |
| `beats`                             | The character lines that play during the case: on `start`, on `complete`, on an objective, or on a report question. Speakers come from `cast.ts` and are never renamed                      |
| `objectives`, `hints`               | 3 to 6 main steps, each with a `why` and a `success` line and a declarative `check`. Bonuses and secrets get a playful 1-to-3-word `name`. Three hints each; **the first names no command** |
| `report`                            | The questions that close the case. Each has an `answer`, an `explain`, and `acceptedEvidence`: the evidence an answer has to point at                                                       |
| `debrief`                           | What they did, one past-tense line per learning goal, the `ethicsNote`, the `defensiveTakeaway` and a one-line `nextTease`                                                                  |

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

1. Write the story first, and only then the objectives and the report. The story is what everything else is checked against.
2. `pnpm evidence:build` — plays it, writes the evidence, and tells you what it couldn't do.
3. `pnpm test:content` — validates every case, checks the committed evidence is what the stories build today, and checks the world rules.
4. Work through the authoring checklist in `docs/plan/99-reference.md`.

`pnpm case:new`, `pnpm case:validate` and `pnpm case:play` arrive with prompt 03.2.

## Names

Every new name — a person, a company, a product, a machine — is searched before it is used, and recorded here. Only `.example` domains, and only reserved addresses (RFC 5737's `192.0.2.0/24`, `198.51.100.0/24` and `203.0.113.0/24`, or a private range). The schema refuses anything else.

| Name             | Checked    | What it is, and what the search found                                                                                                        |
| ---------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Quillfen Freight | 2026-09-22 | The client. No organisation of that name was found (`docs/plan/00-overview.md` §4, row 1)                                                    |
| Pellmoor         | 2026-09-23 | The drive maker printed on the evidence bag, in `baselines/`. No company or brand of that name was found; the nearest are Pella and Pelmorex |
| Wrenfold         | 2026-09-23 | The memory-stick maker a `usb-insert` gives a drive. No company or brand of that name was found; the nearest are Renfold and Wren Kitchens   |
| `mara`           | —          | The yard office account in `_fixture.yaml`. A first name with no surname, standing for nobody. The cast, who do have names, is in `cast.ts`  |

Never import here: anything except `@/content` and `@/sim/types` (ESLint enforces it).
