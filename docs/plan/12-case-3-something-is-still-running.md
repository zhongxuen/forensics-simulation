# 12 — Case 3: Something Is Still Running

**Wave 5 · parallel with 11, 14 · 4–5 days**
**Depends on:** 06, 08, 09, 10
**Owns:** `src/content/cases/case-03.yaml`, its playthrough, `src/content/evidence/case-03/**`, one line in `chapter.ts`, the chapter closing line

## Goal

A ~30-minute case that teaches order of volatility, process trees, hidden processes, network artefacts, injected code, and correlating memory with logon events (the Volatility workflow). It ends the chapter.

## Story (ground truth)

Tuesday 2026-04-14. Quillfen's dispatch server `qf-srv-01` (`10.60.1.10`, Windows-like) has its remote desktop port open to the internet (the "door left open", in Hollow Latch style). The firewall shows it contacting `203.0.113.47` every 60 seconds.

What happened:

1. Sunday night: 312 failed logons (4625) from `198.51.100.23` against common account names, then a successful 4624 type 10 as `dispatch-admin`, a real account with a weak, reused password.
2. A new local account `svc-update` is created (4720) and added to Administrators (4732).
3. A process named `svchost.exe` runs from `C:\ProgramData\svchost.exe` (wrong folder) with **`explorer.exe` as its parent** (should be `services.exe`), and is **unlinked** from the active process list.
4. It has an RWX region not backed by a file (the injected-code indicator) and a connection to `203.0.113.47:443` that restarts every 60 s.
5. A harmless RWX region in a .NET dispatch app (JIT) is there to be told apart.

### Choice beats

- **Before anything:** Kit wants to pull the power cord to stop it. Choice: pull the plug, or capture memory first. Pulling the plug shows Noor explaining order of volatility (RFC 3227): memory, connections and running processes vanish, so the evidence you need most is gone. Then the choice again. Capturing memory is the `capture-memory` action. Idris has the tool ready, the player makes the call.
- **Mid-case:** Kit wants to connect to `203.0.113.47` "to see who's there". Choice: connect, or block it and write it in the report. Connecting shows the no-hacking-back rule with its real consequences (it tips off the attacker, it may be someone else's hacked machine, it's a crime without permission), then the choice again.

## Objectives

1. Capture memory before anything else (choice beat 1).
2. Find the process that talks to `203.0.113.47` (`mem netscan`) and pin it.
3. Show why it's suspicious: its location, its parent, and that the active list hides it (`ps` vs `psscan`, `pstree`).
4. Find the injected region and tell it apart from the harmless one (`malfind`).
5. Find how they got in: the failed-logon burst, the successful logon, the new account (`logq`, `--count-by`).
6. Line it all up on the timeline.

**Bonus:** found the harmless JIT region and said why it isn't the problem. **Secret:** "Every minute on the minute": measured the beacon interval from connection times.

## Report

How they got in (choice + cite the 4625 burst and the 4624) · which account (account) · what they added (account, cite 4720/4732) · which process is malicious (evidence-pick, pid) · why (choice list: wrong folder, wrong parent, unlinked, RWX unbacked) · where it talks to (address) · containment and fixes (choice list: close remote desktop to the internet or put it behind a VPN, reset and uniquely set passwords, MFA, remove `svc-update`, block the address, rebuild from a known-good image).

### Chapter closing

Idris ties the three cases together: one unlocked laptop, one password on a note, one door left open to the internet, and the same `— HL` signature. Write it in the chapter's closing line format from Hacker Simulation, and link to Hacker Simulation's Chapter 2 ("the Hollow Latch have been busy two streets over").

## Prompt 12.1

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md (§Story world, §Voice,
§Authoring checklist, §Six rules) and docs/plan/12-case-3-something-is-still-running.md. Read
case-01's YAML and playthrough as the model, and ../hacker-simulation/src/content/campaigns/ for the
chapter closing format.

Author case-03 with pnpm case:new case-03. Write the ground-truth story exactly as in 12 §Story, both
choice beats with the consequences shown and the choice offered again, objectives, three-tier hints,
the report with acceptedEvidence, and a playthrough that takes both wrong turns, then every bonus and
secret, with all findings supported. Any new names are searched on the web and recorded in
src/content/cases/README.md.
Write the chapter closing line and add case-03 to chapter.ts.
pnpm evidence:build, pnpm case:validate case-03, pnpm case:play case-03, then read it against the
checklist. Finish with pnpm lint, pnpm typecheck, pnpm test and pnpm build green, then commit.
```

## Done when

- [ ] Both choice beats show a consequence, then offer the choice again. Neither ends the case
- [ ] Nothing in the case connects to, probes or "hacks back" at an outside address
- [ ] Solvability, consistency and staleness pass
