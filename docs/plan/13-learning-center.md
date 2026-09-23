# 13 — Learning Center

**Wave 2 (pipeline + Foundations) · parallel with 03, 04, 05 · then more lessons alongside later waves**
**Depends on:** 01 (the vendored lesson pipeline)
**Owns:** `src/content/lessons/**`, `src/content/glossary.ts`, `src/content/tracks.ts`, `src/content/references.ts`, `/learn` routes

## Goal

About 15 MDX lessons in four tracks, each built on Hacker Simulation's six-section structure and each citing a primary source. They go **deeper** than Hacker Simulation's forensics lessons and link to them as prerequisites instead of repeating them.

## Spec

### Prerequisites (link out, don't rewrite)

On `https://hacker-simulation.vercel.app/learn/…`: `forensics-what-logs-are`, `forensics-timelines`, `forensics-evidence-care`, `blue-incident-response`, `blue-reading-alerts`, `crypto-hashing`. The lesson frontmatter gets an `externalPrerequisites` field; the lesson page shows them as "Start here if this is new".

### Tracks and lessons

| Track | Lesson id | Cites |
|---|---|---|
| Foundations | `foundations-what-forensics-is` | NIST SP 800-86 §3 |
| | `foundations-order-of-volatility` | RFC 3227 §2.1, §2.2; NIST SP 800-86 §5.2.1.3 |
| | `foundations-chain-of-custody` | NIST SP 800-86 §3.1.2 (was §3.1.1: checked 2026-09-23, the chain of custody is in §3.1.2); NIST IR 8387 §3.2 |
| | `foundations-hashing-for-evidence` | FIPS 180-4 §1, §6.2; RFC 1321 §1 (and why MD5 alone isn't enough, RFC 6151 §2.1); NIST SP 800-86 §4.2.2; NIST IR 8387 §3.2 |
| Disk | `disk-partitions-and-filesystems` | Carrier, *File System Forensic Analysis*, ch. 5, 11 |
| | `disk-macb-timestamps` | Carrier ch. 13; SANS "Windows Forensic Analysis" poster |
| | `disk-deleted-vs-overwritten` | Carrier ch. 8 |
| | `disk-carving` | Garfinkel, "Carving contiguous and fragmented files with fast object validation" (DFRWS 2007) |
| Memory | `memory-why-ram-matters` | Ligh et al., *The Art of Memory Forensics*, ch. 1 |
| | `memory-processes-and-parents` | *The Art of Memory Forensics* ch. 6; SANS "Hunt Evil" poster |
| | `memory-network-artefacts` | *The Art of Memory Forensics* ch. 11 |
| | `memory-code-injection` | *The Art of Memory Forensics* ch. 8; MITRE ATT&CK T1055 |
| Logs and timelines | `logs-windows-logon-events` | Microsoft Learn: Audit logon events (4624, 4625, logon types) |
| | `logs-time-zones-and-clocks` | RFC 3339; NIST SP 800-92 §2.3 |
| | `logs-super-timelines` | Plaso documentation; NIST SP 800-86 §6 |
| | `report-writing-the-report` | NIST SP 800-61r3; NIST SP 800-86 §3.4 |

The chapter and section numbers above are starting points written from memory. **Each lesson prompt must check its citation against the source** (open the document, confirm the section, fix the number) before it goes into `references.ts`.

Every lesson: six sections (99 §Lesson structure), a `<MiniTerminal>` on the real engine with a tiny generated evidence set (never a fake), a `<Quiz>` with an explanation for every option, and `<Term>` for new words. `src/content/references.ts` holds each citation; a test fails if a lesson's frontmatter cites an id that isn't there, or if a lesson has no citation.

Each tool's man page links to its lesson, and each lesson's "In practice" section names the case where the player meets it.

### Glossary

Start from Hacker Simulation's forensics and blue-team words, plus: acquisition, write-blocker, image, hash collision, MACB, file record, cluster, unallocated space, carving, magic bytes, volatility (the order, not the tool), process list, parent process, unlinked process, beacon, RWX, logon type, super-timeline, custody log. Same one-sentence rule and banned-word test.

## Prompt 13.1 — pipeline wiring and Foundations track

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md (§Lesson structure, §Voice) and
docs/plan/13-learning-center.md. Read ../hacker-simulation/src/content/lessons/README.md, two of its
lessons (forensics-evidence-care.mdx, crypto-hashing.mdx) and its references.ts as the model.

You own only the paths under "Owns" in 13. Other agents are building 03, 04 and 05 at the same time.
1. Add externalPrerequisites to the lesson frontmatter schema and render it.
2. Add the citation test for references.ts.
3. Write the four Foundations lessons. Each <MiniTerminal> uses the workstation commands only for
   now (disk tools arrive with file 04; leave a TODO naming 04 where a lesson wants acquire or
   hashsum).
4. Add the glossary words the four lessons use.
pnpm test runs the banned-word and one-sentence checks. Finish with pnpm lint, pnpm typecheck,
pnpm test and pnpm build green, then commit.
```

## Prompt 13.2 — Disk track (run in wave 3 or 4, after 04 and 07 merge)

```text
Read docs/plan/13-learning-center.md. Write the four Disk lessons with <MiniTerminal>s that use
lsfs, inode, recover and carve on small generated evidence sets, and resolve the TODOs 13.1 left for
acquire and hashsum. Add their glossary words and references. Link each tool's man page to its
lesson. Commit when pnpm test and pnpm build are green.
```

## Prompt 13.3 — Memory and Logs tracks (run in wave 5, after 08 and 09 merge)

```text
Read docs/plan/13-learning-center.md. Write the four Memory lessons and the four Logs and timelines
lessons, with <MiniTerminal>s using mem, logq and timeline, glossary words, references, man-page links,
and "In practice" sections naming case-02 and case-03. Commit when pnpm test and pnpm build are green.
```

## Done when

- [ ] 16 lessons, each with a citation that the test checks, a MiniTerminal on the real engine and a Quiz
- [ ] Every tool's man page links to a lesson and every lesson names a case
