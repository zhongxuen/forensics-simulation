# 99 — Reference: story world, voice, tools, risks, sources

Every prompt reads this file. It summarises the rules this game inherits from Hacker Simulation (`../hacker-simulation/md-files/remaining.md`, Part 2) and adds the forensics-specific ones. When the two disagree, Hacker Simulation's file wins for shared world facts. Update this file, not the prompts.

---

## Story world

**Premise.** The player is the newest member of **Candlewright Security**'s blue team. Organisations *ask* for help and sign a letter saying what may be examined. Every case starts with that letter, readable on the workstation.

**Cast** (speaker ids fixed in `src/content/cast.ts`, copied from Hacker Simulation, never renamed):

| Speaker id | Name | Pronouns | Role in this game |
|---|---|---|---|
| `teammate-idris` | Idris Fenwick | he/him | Leads the investigations. Reads logs slowly and kindly, delivers the twists |
| `mentor-noor` | Noor Halvorsen | she/her | Mentor. Asks what you've tried, points at the next door, never hands over the answer. The in-world face of the AI mentor |
| `teammate-kit` | Kit Nakashima-Reyes | they/them | The player's peer. Eager, drives the temptation beats, owns mistakes gracefully |
| `teammate-theo` | Theo Ashgrove | he/him | Team lead. Signs the letters, handles the client, carries the ethics through consequences |
| `client-roz` | Roz Kowalczyk | she/her | Not in this chapter. Available for a cameo |

The player has no name, gender or backstory. Their workstation account is `examiner`, and characters say "you".

**The Hollow Latch.** Patient opportunists who find doors left open. They appear only through traces after the fact, never speak, and are never glamorous. Calling card: a text file signed `— HL`: "The door was open."

**New world facts (this chapter):**

| Place | Domain | Networks | Notes |
|---|---|---|---|
| Candlewright blue-team room | `candlewright.example` | `10.20.0.0/24` | Analyst workstation `ir-ws-01` |
| Quillfen Freight, office | `quillfen.example` | `10.60.0.0/24` | A small family haulage yard. Yard office laptop `qf-lt-03` (`10.60.0.21`), bookkeeper's laptop `qf-lt-07` (`10.60.0.27`) |
| Quillfen Freight, servers | `quillfen.example` | `10.60.1.0/24` | Dispatch server `qf-srv-01` (`10.60.1.10`), remote desktop open to the internet |
| Addresses from outside | — | `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` | RFC 5737 documentation ranges only |

Name check (2026-09-22): "Quillfen" returned no organisation. "Harrowgate", the old name, was dropped because a real Harrowgate Ltd and several Harrow Logistics companies exist. Every new name (people, companies, products) is searched before use and recorded in `src/content/cases/README.md`. Quillfen's owner and staff never speak (no speaker id). Their voice arrives as letters, forms and messages the player reads.

**Six rules** (from Hacker Simulation, applied to investigations):

1. **Every case has a client who asked**, named in the briefing with who signed.
2. **Scope has edges.** The letter says what may be examined, and cases show something out of scope (a staff member's personal phone, the customer's systems) and keep it out.
3. **Defence comes out of every case.** Each ends with fixes the client can make.
4. **No targets, only clients.** The investigation is of the organisation's machines and logs, never of a person. Evidence decides, and it may clear the person everyone suspected.
5. **No hacking back.** Never connect to, probe or "check" an attacker's address.
6. **Temptation shows consequences, not punishment.** A wrong choice gets Noor's explanation and the choice again. No fail screens.

**Tone:** light, curious, encouraging, like a good workplace comedy that takes its job seriously. Errors, ethics and real-world consequences stay plain and sincere. The client is never the butt of the joke.

**Cold opens:** every case stands alone. Name plus role on each character's first line, at most two lines before the first objective.

## Voice

Second person, active voice, short sentences. Plain words first, real term right after. Celebrate specifically. Humour in flavour text only.

- **Error template:** `{What happened, in plain words}. {Why, in one sentence}. {One thing to try next}.`
- **Empty-state template:** `{What will be here}. {Why it's empty right now}. [{One action}]`
- **Banned words** (checked by `src/content/voice.ts` over cases, lessons, glossary, man pages and mentor prompts): simply, just, merely · obviously, clearly, of course, as you know · easy, trivial, basic, quick (as a judgement) · unexplained acronyms · invalid, illegal, wrong, failed (about the player) · n00b, script kiddie, 1337, ninja, rockstar · victim, hack anyone, take down. They may appear inside realistic tool output.
- **Saving:** case runs *are* saved in this browser (00 §4 row 9). Say "Saved in this browser only." Never promise more.
- Buttons say what happens ("Open Case 1", "Submit report"). Sentence case. Commands, paths, addresses and event ids in `code font`.

## Banned engagement mechanics

Lives or energy, timers that gate play, daily streaks, scores that drop for hints, pay-to-skip, leaderboards, loot boxes, guilt notifications. The report shows "n of m findings supported", never a number that can go down.

## Simulation framing

Every terminal and evidence view carries a persistent, non-dismissible SIMULATED marker. Tools have invented names. Output is representative and written from scratch, never a byte-copy of a real tool. Real tool names appear only in "Real-world equivalent" sections and lessons, and the registry test bans them as command names.

## Tool reference

| Game tool | File | Does | Real-world equivalent |
|---|---|---|---|
| `blocker` | 04 | Turns a device's write-blocker on or off | Hardware write-blockers (Tableau), FTK Imager's read-only mount |
| `acquire` | 04 | Images a device, prints hashes | FTK Imager → Create Disk Image; `dd`, `dcfldd`, `ewfacquire` |
| `hashsum` | 04 | MD5 / SHA-1 / SHA-256, `--verify` | FTK Imager → Verify Drive/Image; `sha256sum`, `Get-FileHash` |
| `lsfs` | 04 | Lists file records, including deleted | The Sleuth Kit `fls`; Autopsy file view |
| `inode` | 04 | One record's metadata and MACB | The Sleuth Kit `istat`; Autopsy metadata |
| `recover` | 04 | Restores a deleted file if not overwritten | Autopsy Extract File; `icat` |
| `pin` | 04 | Pins an output line's artefact to the board | Autopsy tags and bookmarks |
| `carve` | 07 | Finds files in unallocated space by signature | PhotoRec, Foremost, Autopsy carving |
| `strings` | 07 | Printable strings with offsets | `strings`, `bstrings` |
| `logq` | 07 | Filters and counts log records | Event Viewer, `grep`, a SIEM query |
| `mem info/ps/psscan/pstree/netscan/cmdline/malfind/strings` | 08 | Memory analysis | Volatility 3 `windows.*` plugins |
| `timeline` | 09 | Super-timeline of every artefact | Plaso/log2timeline + psort, Autopsy Timeline, Timesketch |

## Lesson structure

Six sections: 1. the one-sentence version (with the analogy) · 2. why it matters in security · 3. how it actually works · 4. see it (interactive, never skipped) · 5. in practice (which case) · 6. common misconceptions (from real confusion). `<Quiz>` explains every option. `<MiniTerminal>` runs the real engine on real generated evidence, never a simpler fake.

## Authoring checklist (per case)

- [ ] `pnpm case:validate <id>` passes with no TODOs
- [ ] `pnpm case:play <id>` completes with at least one wrong turn, every bonus and every secret, and every finding supported
- [ ] First tick in under 2 minutes. 3 to 6 main objectives
- [ ] Every idea is explained (story beat or `concepts` lesson) before an objective needs it
- [ ] Every objective has a `why` and a specific `success`. Bonuses and secrets have playful names
- [ ] Three hints per objective. Tier 1 doesn't name the command
- [ ] A real `authorization`, `ethicsNote` and `defensiveTakeaway`
- [ ] Only cast characters and world-fact places. Reserved addresses. `.example` domains. New names searched and recorded
- [ ] Every report question has `acceptedEvidence` that resolves, and an `explain` that doesn't give the answer away
- [ ] Read the transcript out loud: would a complete beginner understand it and want to keep going?
- [ ] Watch someone with no security background play it. If most need the third hint somewhere, rewrite the step

## Risks

| Risk | Mitigation |
|---|---|
| Evidence drifts out of sync with itself | Generator + consistency, staleness and answer-integrity tests (03). Hand-authored evidence isn't possible |
| A story edit makes a case unsolvable | Solvability test on every build (03) |
| Beginners get lost in raw evidence | Beginner mode suggests the next tool, three-tier hints, Noor, noise density per case, Case 1 kept short |
| Output looks too much like real tools (IP/trademark) | Invented names, formats written from scratch, real names only in reference text, registry ban list |
| A made-up name matches a real organisation or person | Search every new name and record the check (as Harrowgate → Quillfen) |
| Insider-style story reads as blaming a person | Rule 4. Case 2 clears the suspected person by evidence. Copy refers to roles |
| Evidence JSON blows the JS budget | Dynamic `import()` per case, baselines kept small, `bundle:check` in CI |
| Hash implementation bug | Differential test against `node:crypto` on 200 inputs + standard vectors |
| Saved runs break after a schema change | Versioned key, Zod parse, `migrate()`, and a replay-based save (command log, not engine state) |
| The mentor leaks report answers | The answer key is never in model context. Injection tests (14) |
| Scope creep (more OSes, artefacts, cases) | v1: Windows-like evidence, Linux-like workstation, three cases. Everything else goes into `futureImprovements` |

## Future improvements (not v1)

Registry hives and prefetch/amcache · browser history as its own source · mobile evidence · a Linux server case · clock-skew case (the library's wifi controller, 43 minutes fast, from Hacker Simulation) · the false-positive alert case from Hacker Simulation's Chapter 3 seeds · a Chapter 2 · translated lessons.

## Sources

NIST SP 800-86, *Guide to Integrating Forensic Techniques into Incident Response* · NIST SP 800-61r3, *Incident Response Recommendations and Considerations for Cybersecurity Risk Management* · NIST SP 800-92, *Guide to Computer Security Log Management* · NIST IR 8387, *Digital Evidence Preservation* · RFC 3227, *Guidelines for Evidence Collection and Archiving* · RFC 3339 · RFC 5737 · RFC 2606 · RFC 1321, RFC 6151 · FIPS 180-4 · B. Carrier, *File System Forensic Analysis* · M. Ligh et al., *The Art of Memory Forensics* · S. Garfinkel, DFRWS 2007 carving paper · SANS DFIR posters ("Hunt Evil", "Windows Forensic Analysis") · Microsoft Learn: Windows security audit events · MITRE ATT&CK T1055 · Volatility 3, The Sleuth Kit / Autopsy and Plaso documentation (for "Real-world equivalent" text only).
