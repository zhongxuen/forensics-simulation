# 11 — Case 2: The Deleted Invoice

**Wave 5 · parallel with 12, 14 · 4–5 days**
**Depends on:** 06, 07, 09, 10
**Owns:** `src/content/cases/case-02.yaml`, its playthrough, `src/content/evidence/case-02/**`, one line in `chapter.ts`

## Goal

A ~30-minute case that teaches MACB timestamps, deleted vs overwritten, recovery, carving, logon events and time zones (the Autopsy workflow), and ends with the evidence **clearing** the person everyone suspected.

## Story (ground truth)

Same Saturday as Case 1 (2026-04-11). Quillfen's bookkeeper logged off their laptop `qf-lt-07` at 17:31 UTC and went home. Monday morning, an invoice folder is missing and a customer has a copy of a price list they shouldn't have. The owner's first thought is the bookkeeper. Theo is clear with the owner that Candlewright looks at **the company's laptop and logs**, not at a person, and that the report will say what the evidence shows, whoever it points at.

What actually happened (the player works this out):

1. 19:38 UTC: someone at the unlocked yard office laptop `qf-lt-03` (`10.60.0.21`, Case 1's machine) found the bookkeeper's password on a note in a shared folder.
2. 19:40: a **remote logon** (Windows event 4624, logon type 10) to `qf-lt-07` as the bookkeeper, **from `10.60.0.21`**. The bookkeeper's own logons are always type 2 (at the keyboard).
3. 19:41: a zip of the price lists is created on `qf-lt-07`, copied back to `qf-lt-03` over the office file share, then sent out (firewall log: an upload from `qf-lt-03` to `203.0.113.80`).
4. 19:42: invoices deleted. Two are **recoverable** (clusters not reused). One was **partly overwritten** by the zip, and can only be **carved** as a partial PDF: that's the deleted-vs-overwritten lesson.
5. 19:44: the `— HL` note created on `qf-lt-03` (ties to Case 1).

**The time-zone twist:** the owner's complaint says "deleted around 20:40", and the yard's door log (a handover document, not a log source) says the bookkeeper badged out at 18:31. Both are **local time (BST, UTC+1)**. Naively comparing them with the UTC security log makes the bookkeeper look present. Converting properly shows they'd left over an hour before. The Timeline's zone banner (09) and a lesson (13) carry this.

## Objectives

1. Image and verify `qf-lt-07` (quick, reuses Case 1's skill; the briefing says so).
2. List deleted files and pin the invoices' records.
3. Recover what can be recovered. Carve what can't, and pin the partial PDF.
4. Find the remote logon and where it came from (`logq --id 4624`, `--where LogonType=10`).
5. Put the evening in order on the timeline, in one zone.
6. Find where the files went (firewall).

**Choice beat:** the owner (through a message the player reads) asks for the report to "just confirm it was the bookkeeper". The player picks how to respond. The right answer is to report what the evidence shows. Picking otherwise gets Noor's explanation (a report that bends to the client is worthless in court and unfair to a person), then the choice again.

**Bonus:** noticed the harmless noise event that looks suspicious but isn't (a scheduled backup at 19:45). **Secret:** "Two clocks": converted the door log to UTC before citing it.

## Report

Who logged on (account) · from which machine (host) · logon type (choice) · when the invoices were deleted (timestamp) · was the bookkeeper at the yard at that time (choice, cite the door log conversion and the logon events) · where the data went (host/address) · two fixes (choice list: unique accounts, no passwords in shared folders, lock screens, egress filtering).

Defensive takeaway: the owner leaves with changes they can make this week, and an apology is owed to the bookkeeper. The report says so plainly.

## Prompt 11.1

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md (§Story world, §Voice,
§Authoring checklist) and docs/plan/11-case-2-the-deleted-invoice.md. Read case-01's YAML and
playthrough as the model.

Author case-02 with pnpm case:new case-02. Write the ground-truth story exactly as in 11 §Story,
including the partly overwritten invoice, the harmless 19:45 backup, the local-time complaint and door
log, and the firewall upload. The bookkeeper is referred to by role in all copy; the account name is
the only identifier. Choose any new names (account names, the customer), search each on the web, and
record the check in src/content/cases/README.md.
Write objectives, three-tier hints (tier 1 never names the command), the choice beat, the report with
acceptedEvidence patterns, and the playthrough with at least one wrong turn (compares local and UTC
times without converting, then fixes it), every bonus and secret, all findings supported.
pnpm evidence:build, pnpm case:validate case-02, pnpm case:play case-02. Read the transcript against
the authoring checklist and the six rules in 99. Add case-02 to chapter.ts.
Finish with pnpm lint, pnpm typecheck, pnpm test and pnpm build green, then commit.
```

## Done when

- [ ] Solvability, consistency and staleness tests pass for case-02
- [ ] Nothing in the copy names or blames a person. The report clears the bookkeeper by evidence
- [ ] The time-zone wrong turn is in the playthrough
