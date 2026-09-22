# 03 — Case format, story → evidence generator, solvability

**Wave 2 · parallel with 04, 05, 13 · 4–5 days**
**Depends on:** 02
**Owns:** `src/content/cases/schema.ts`, `src/content/cases/README.md`, `src/sim/evidence/generate/**`, `scripts/build-evidence.ts`, `scripts/case-*.ts`, `src/features/cases/loader/**`, `src/features/cases/server.ts`, `tests/content/**`

## Goal

Nobody writes evidence by hand. A case YAML describes the **ground-truth story**. A pure generator plays that story against a clean machine and produces the disk, memory and logs. Tests prove the evidence agrees with itself and that every report question can be answered with the game's tools.

This is the most important file in the plan. If this works, cases are cheap to write and hard to break.

## Spec

### Case YAML (the schema, `src/content/cases/schema.ts`)

Modelled on Hacker Simulation's mission schema (`../hacker-simulation/src/content/schemas/mission.ts`): reuse its field names for briefing, cast lines, objectives, hints (three tiers, tier 1 doesn't name the command), `why`, `success`, bonuses, secrets, `concepts` (lesson ids), `authorization`, `ethicsNote`, `defensiveTakeaway`. New sections:

```yaml
id: case-02
title: The Deleted Invoice
client: { org: Quillfen Freight, signedBy: "...", letter: "..." }   # readable on the workstation
estimatedMinutes: 30
seed: 2026042
machines:
  - id: qf-lt-07                 # role-NN naming, fully qualified in quillfen.example
    kind: windows-laptop
    baseline: office-laptop-v1   # a clean machine template from src/sim/evidence/generate/baselines/
    zone: Europe/London
story:                            # ground truth, in order. Times are ISO with an explicit zone
  - at: 2026-04-11T17:31:00Z
    actor: user:dana
    do: logoff
    on: qf-lt-07
  - at: 2026-04-11T19:40:12Z
    actor: attacker
    do: logon
    on: qf-lt-07
    with: { account: dana, type: remote, from: 10.60.0.21 }
  - at: 2026-04-11T19:42:03Z
    actor: attacker
    do: delete-file
    on: qf-lt-07
    path: 'C:\Users\dana\Documents\Invoices\inv-0412.pdf'
noise: { profile: office-day, density: medium }   # seeded benign activity around the story
evidence:
  disks: [qf-lt-07]
  logs: [security, firewall]
  memory: []
objectives: [...]
report:
  questions:
    - id: when-deleted
      ask: When was the invoice deleted?
      type: timestamp            # choice | timestamp | evidence-pick | account | host
      answer: 2026-04-11T19:42:03Z
      toleranceSeconds: 60
      acceptedEvidence: [ "disk:qf-lt-07:mft/*inv-0412*", "log:security/where eventId=4660" ]
      explain: ...
playthrough: playthroughs/case-02.yaml
```

`acceptedEvidence` patterns are resolved against the generated evidence at build time into concrete `ArtefactRef`s. The resolver fails the build if a pattern matches nothing.

### Story actions (the generator's vocabulary)

`logon`, `logoff`, `failed-logon`, `create-account`, `add-to-group`, `create-file`, `modify-file`, `read-file`, `delete-file`, `overwrite-clusters`, `copy-to-usb`, `usb-insert`, `browse` (URL, for history), `download`, `run-process` (name, path, parent, cmdline), `inject` (into pid, protection), `connect` (proto, remote, interval for beacons), `firewall-allow`/`firewall-block`, `dns-query`, `web-request`, `clock-skew` (for the time-zone and skew lessons), `capture-memory`, `hand-over` (for chain of custody). Each action has one pure function that updates the machine state **and** emits every artefact it would really leave (MACB changes, log records, process entries, connection entries, strings). One action, one file, one test.

### Generator (`src/sim/evidence/generate/`)

`generate(caseSpec): EvidenceSet`. Pure and seeded: the vendored RNG drives noise and made-up details. Steps: build baseline machines → merge story actions with noise actions, sorted by time → apply each → snapshot disks, capture memory at the `capture-memory` time, collect logs → compute handover hashes with the pure hashes. `scripts/build-evidence.ts` (Node) loads every case YAML, runs `generate`, and writes `src/content/evidence/<case>/evidence.json` with stable key order (vendored `stable-json`).

Baselines: `office-laptop-v1`, `office-server-v1`, `analyst-workstation-v1`. Keep them small: tens of files, not thousands. Evidence per case should stay under ~400 KB of JSON.

### Noise profiles

`office-day`, `quiet-night`, `server-idle`: benign logons, file saves, browsing to `*.example`, DNS lookups, scheduled tasks. The noise ratio makes a case harder or easier without changing the story. Noise must never produce an artefact that matches an `acceptedEvidence` pattern (tested).

### Tests (all in `tests/content/`)

1. **Schema:** every case parses. Readable errors, like `mission:validate`.
2. **Consistency:** for every story action, every artefact it emitted exists in the evidence with the same instant (MACB, log `at`, process `createdAt`, connection `createdAt`).
3. **Staleness:** regenerating gives byte-identical JSON to what's committed. CI runs `pnpm evidence:check`.
4. **Determinism:** generating twice in one process is deep-equal.
5. **Solvability:** each case has a playthrough (commands, pins, report answers) that the headless runner plays with only the game's tools. It must reach every objective and get every report question **supported**. If a story edit breaks it, the build fails.
6. **Answer integrity:** each question's `answer` is derivable from the story (for example, `when-deleted` equals the `delete-file` action's instant). A mismatch between the story and the answer key fails.
7. **World rules:** only `.example` domains and reserved addresses (reuse Hacker Simulation's check), cast ids from `cast.ts`, banned words from `voice.ts`.

### Scripts

`pnpm evidence:build`, `pnpm evidence:check`, `pnpm case:new <id>` (scaffold a valid, playable case with TODO copy and a playthrough), `pnpm case:validate [id…]`, `pnpm case:play <id>` (headless transcript). Enable the CI placeholders from 01.

The solvability runner needs the tools from 04, 07, 08 and 09. Build the runner against the registry so it works with whatever is registered, and use a fixture case with only workstation commands (`cat`, `grep`) until 04 merges.

## Prompt 03.1 — schema, loader, generator core

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md and
docs/plan/03-case-format-and-generator.md. Read ../hacker-simulation/src/content/schemas/mission.ts,
../hacker-simulation/src/features/missions/ (loader, evaluate.ts) and
../hacker-simulation/scripts/mission-*.ts as the models to follow.

You own only the paths listed under "Owns" in 03. Other agents are building disk tools (04),
the workspace UI (05) and lessons (13) at the same time.

1. Write the case schema in src/content/cases/schema.ts as in 03 §Case YAML, reusing the mission
   schema's field names and hint rules.
2. Write the generator core in src/sim/evidence/generate/: the action registry (one file per action
   in 03 §Story actions, each with a unit test), the three baselines, the noise profiles, and
   generate(caseSpec). Pure and seeded.
3. Write the acceptedEvidence resolver, failing loudly when a pattern matches nothing.
4. Write scripts/build-evidence.ts with stable key order, and the loader in
   src/features/cases/loader/ (server side, via src/features/cases/server.ts) plus a client
   loadEvidence(caseId) that uses dynamic import() so evidence is never in a page's first download.
5. Add a fixture case src/content/cases/_fixture.yaml that uses only workstation commands.
Finish with pnpm lint, pnpm typecheck and pnpm test green, then commit.
```

## Prompt 03.2 — tests and authoring scripts

Run after 03.1, same wave.

```text
Read docs/plan/00-overview.md and docs/plan/03-case-format-and-generator.md.
Write the seven test groups in 03 §Tests and the scripts in 03 §Scripts (evidence:build,
evidence:check, case:new, case:validate, case:play), modelled on ../hacker-simulation's mission
scripts. The solvability runner plays a playthrough through the tool registry, so it works with
whatever tools are registered. Turn on the evidence:check and case:validate steps in CI.
Prove the failure modes: add a test that edits the fixture story in memory (moves an action by an
hour) and shows consistency, answer integrity and staleness each failing with a readable message.
Finish with pnpm lint, pnpm typecheck and pnpm test green, then commit.
```

## Done when

- [ ] `pnpm case:new demo && pnpm case:validate demo && pnpm case:play demo` works end to end
- [ ] Moving one story action by an hour fails consistency, answer integrity or staleness, with a message that names the action
- [ ] Evidence loads through `import()` and appears as its own chunk in the build output
