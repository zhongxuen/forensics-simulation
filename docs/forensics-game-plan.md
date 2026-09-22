# Forensics Game — Implementation Plan

Written: 2026-09-22
Status: **[planned]**
Working title: **Candlewright: Incident Room** (rename freely)
Repo: new, `forensics-simulation` (sibling of `hacker-simulation`)
Hosting: its own Vercel project. **No database** (see [README.md](README.md) §2)

---

## 1. Pitch

A story game where you join Candlewright Security's **blue team** after a made-up break-in at a made-up client. You get three pieces of evidence: a **disk image**, a **memory dump** and a set of **logs**. You examine them in a simulated terminal and three investigator views. You pin findings to a case board and close the case with a report that answers *who, what, when, how, and what should they fix*.

Hacker Simulation teaches how an attacker thinks. This game teaches how a defender reconstructs what happened. The two sites link to each other.

**Portfolio gap it fills:** `data/skills.ts` lists Autopsy, Volatility Workbench and FTK Imager, but no project uses them. Each view in this game copies the workflow of one of those tools, and a "Real-world equivalent" panel names the actual tool, plugin or menu path.

---

## 2. Audience and scope

- **Audience:** the same complete beginners as Hacker Simulation, plus students on a digital forensics course who want to practise the workflow.
- **Scope of v1:** one chapter with **three cases**, plus a sandbox evidence set with no goals.
- **Not in scope:** real disk-image parsing (E01/raw), real memory analysis, real malware, or exam prep. All evidence is made up and generated from an authored scenario.

---

## 3. What to reuse from Hacker Simulation

Copy these into `src/vendor/` and record the source commit in `VENDORED.md`:

| From `hacker-simulation/src/` | Used for |
|---|---|
| `sim/core/` (rng, clock, events, step, result, errors, serialize, replay, stable-json) | The deterministic engine loop |
| `sim/fs/` (tree, path, resolve, perms, mode) | The disk image's filesystem, extended with deleted entries and timestamps (§5.1) |
| `sim/shell/` + `features/terminal/parser` | Pipes, `grep`, redirection, `&&`, all unchanged |
| `features/terminal/` components, a11y, beginner mode | The terminal UI |
| `features/mentor/` | Optional AI mentor ("Noor" can come back, or a new blue-team lead) |
| Content pipeline (YAML missions + MDX lessons + Zod schemas + `mission:validate`) | Cases are YAML files, lessons are MDX |
| Security-headers, bundle-scan and contrast scripts | Same quality checks |

Only the **tools** (`sim/tools/`) and the **evidence model** are new.

---

## 4. The cases (v1)

All three cases take place at one made-up client, **Harrowgate Logistics**, using only reserved IP ranges (RFC 5737 `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) and example domains (RFC 2606 `*.example`).

| # | Case | Main evidence | Skills taught |
|---|---|---|---|
| 1 | **The Clean Copy.** A laptop is handed in. Image it, hash it, and prove the copy is identical | Disk | Acquisition, write-blocking, MD5/SHA-256 verification, chain of custody (FTK Imager workflow) |
| 2 | **The Deleted Invoice.** An insider is suspected of deleting records and taking data out | Disk + logs | File system timestamps (MACB), deleted-file recovery, carving by magic bytes, USB artefacts, browser history (Autopsy workflow) |
| 3 | **Something Is Still Running.** A server is beaconing out | Memory + logs | Process tree, network connections, command lines, injected-code indicators, correlating with auth logs (Volatility workflow) |

Final report for each case: a structured form (multiple choice + pick-a-timestamp + pick-the-evidence) that the engine grades deterministically, so no AI grading is needed. Each answer has to cite a pinned piece of evidence. **An answer with no evidence scores zero.** That rule teaches the most important habit in forensics.

---

## 5. The evidence model (pure TypeScript, in `src/sim/evidence/`)

### 5.1 Disk image

Extends the copied virtual filesystem:

```ts
interface ForensicInode {
  id: number;                  // MFT-record-like number
  path: string;
  size: number;
  content: Uint8Array | string;
  times: { m: Tick; a: Tick; c: Tick; b: Tick };   // MACB
  deleted: boolean;            // recoverable while its clusters aren't reused
  clusters: number[];          // for carving and overwrite demos
  owner: string;
}
interface DiskImage {
  id: string;
  sectors: number;
  partitions: Partition[];
  inodes: ForensicInode[];
  unallocated: Uint8Array;     // where carved files hide
  hashes: { md5: string; sha256: string };  // computed at build time
}
```

### 5.2 Memory dump

```ts
interface MemoryImage {
  capturedAt: Tick;
  processes: { pid; ppid; name; cmdline; createdAt; user; threads; hidden?: boolean }[];
  connections: { pid; proto; local; remote; state }[];
  modules: { pid; path; base; size }[];
  suspiciousRegions: { pid; base; protection: "PAGE_EXECUTE_READWRITE" | ...; preview: string }[];
  strings: { offset; value }[];
}
```

`hidden: true` sets up the classic teaching moment where a process appears in one list but not another (a pslist-vs-psscan style comparison).

### 5.3 Logs

Normalised events with a `source` of `auth | windows-security | web-access | firewall | dns`, rendered in the native format of each source (for example a Windows event with IDs 4624, 4625, 4688 and 4720, or an Apache combined-log line).

### 5.4 Scenario → evidence generation

Nobody writes evidence by hand. A case YAML describes the **ground-truth story** (an ordered list of attacker and user actions). A **generator** (`scripts/build-evidence.ts`) plays that story against a clean machine and emits the disk, memory and logs as artefacts, which are committed to the repo as JSON under `content/evidence/<case>/`. This keeps the evidence consistent with itself: a file created at T appears in the MACB times, in the logs and in the timeline, all at T.

**Solvability test** (the most important test in the repo): for every question in a case, a scripted solver checks that the answer can be reached using only the game's tools on the generated evidence. If a story edit makes a case unsolvable, the build fails.

---

## 6. Tools (simulated, `src/sim/tools/forensics/`)

Hacker Simulation gives its tools **made-up names** so they can't be mistaken for real ones, and this game follows that rule. Each tool's man page includes a **"Real-world equivalent"** section.

| Game tool | Does | Real-world equivalent |
|---|---|---|
| `acquire` | Images a device through a simulated write-blocker and prints the hash | FTK Imager → Create Disk Image; `dd`/`dcfldd` |
| `hashsum` | MD5 / SHA-1 / SHA-256 of an image or file | FTK Imager → Verify Drive/Image; `sha256sum` |
| `fls` / `istat` style: `lsfs`, `inode` | Lists files including deleted ones, shows MACB | The Sleuth Kit `fls`/`istat`; Autopsy file view |
| `recover` | Restores a deleted file if its clusters haven't been reused | Autopsy / `icat` |
| `carve` | Scans unallocated space for magic bytes (`%PDF`, `PK\x03\x04`, `\xFF\xD8\xFF`) | PhotoRec, Foremost, Autopsy carving module |
| `strings` | Printable strings with offsets | `strings` |
| `mem ps` / `mem psscan` / `mem pstree` | Process lists (one of them misses hidden processes) | Volatility 3 `windows.pslist` / `psscan` / `pstree` |
| `mem netscan` | Sockets and connections | Volatility 3 `windows.netscan` |
| `mem cmdline` | Process command lines | Volatility 3 `windows.cmdline` |
| `mem malfind` | RWX regions with a preview | Volatility 3 `windows.malfind` |
| `logq` | Filters logs by source, time or field | Event Viewer, `grep`, a SIEM query |
| `timeline` | Merges every artefact into a super-timeline | Plaso/log2timeline, Autopsy Timeline |
| `pin` | Pins the current output line to the case board with a note | Autopsy "Tag file" / bookmarks |

The real names appear only in the reference panel and in the lessons. Tool output is realistic but never copied from real tools.

---

## 7. UI

Four panes, and each can also be reached from the terminal:

1. **Terminal**, copied from Hacker Simulation.
2. **Evidence Browser**, an Autopsy-like view: a tree on the left (partitions → folders, with deleted items struck through), a file table in the middle (MACB columns, sortable), and hex/text/metadata tabs on the right.
3. **Timeline**: a horizontal, zoomable track per source (disk / memory / auth / web / firewall). Clicking an event cross-highlights the same moment in the other tracks. This is where most "aha" moments happen.
4. **Case Board**: pinned evidence cards, each with a source, timestamp and note. The final report form pulls its citations from here.

Plus **Chain of Custody**: a running log of every action the player took (acquired, hashed, opened). It is shown at the end, and a bonus is awarded if the player hashed before analysing. It teaches that the order of steps matters.

Accessibility: every visual pane also has a table or list form (as Internet Visualizer does with its canvases), and the timeline can be used with the keyboard (←/→ step, Enter pins).

---

## 8. Data and state (no database)

| Data | Where |
|---|---|
| Cases, stories, lessons, glossary | Repo: `content/cases/*.yaml`, `content/lessons/*.mdx` |
| Generated evidence | Repo: `content/evidence/<case>/*.json` (built by script, committed, checked for staleness in CI) |
| Progress, pinned evidence, report drafts | `localStorage` key `ir:v1`, Zod-parsed on load, with a migration function |
| Moving progress between devices | Export/import JSON button |
| Mentor | Optional `/api/mentor` route calling the Claude API (current Haiku model). Without a key, it falls back to hints written ahead of time, as Hacker Simulation does |

Firebase isn't needed. A leaderboard is out of scope (see README §2).

---

## 9. Learning Center

About 15 MDX lessons in four tracks, each citing a primary source:

- **Foundations:** what forensics is, order of volatility (RFC 3227), chain of custody, hashing (FIPS 180-4).
- **Disk:** partitions, file systems, MACB timestamps, deleted-vs-overwritten, carving.
- **Memory:** why RAM matters, processes and parents, network artefacts, code injection.
- **Logs and timelines:** log sources, Windows security event IDs, correlation, writing the report.

Main references: NIST SP 800-86 (*Guide to Integrating Forensic Techniques into Incident Response*), NIST SP 800-61r2/r3 (*Incident Handling*), RFC 3227, the SANS DFIR posters, *The Art of Memory Forensics* (Ligh et al.), and *File System Forensic Analysis* (Carrier).

---

## 10. Testing

- Engine unit tests for every tool, including a golden transcript for each case, as in Hacker Simulation.
- **Solvability test** for each case (§5.4).
- **Evidence consistency test:** every event timestamp in the timeline matches the MACB times, log times and memory `createdAt` it came from.
- **Staleness test:** regenerating the evidence gives output byte-identical to what is committed.
- **Hash test:** image hashes shown in game = SHA-256 of the serialised image, computed with Node `crypto`.
- Playwright: complete case 1 end-to-end, keyboard-only.
- axe on every route. Per-page JS budget of 200 KB, matching Hacker Simulation.

---

## 11. Phases

| Phase | Deliverable | Estimate |
|---|---|---|
| 0 | Repo scaffold, vendored engine, ESLint boundaries, CI | 2–3 days |
| 1 | Disk model + `acquire`/`hashsum`/`lsfs`/`inode`/`recover` + Evidence Browser + **Case 1** playable | 1–2 weeks |
| 2 | Scenario → evidence generator + solvability test + `carve`/`strings`/`logq` + **Case 2** | 2 weeks |
| 3 | Memory model + `mem *` tools + Timeline view + **Case 3** | 2 weeks |
| 4 | Case Board, report grading, Chain of Custody, Learning Center | 1–2 weeks |
| 5 | Mentor (optional), accessibility pass, polish, landing page, portfolio entry | 1 week |

You can ship after phase 1: "Case 1 only" is an honest disclaimer, just as Hacker Simulation's "Chapter 1 only" is.

---

## 12. Portfolio entry (draft)

- **technologies:** Next.js, TypeScript, React, Tailwind CSS, Zod, Zustand, Vitest, Playwright (+ Claude API if the mentor ships)
- **skills this backs up:** Autopsy, Volatility Workbench, FTK Imager (already in `data/skills.ts`)
- **disclaimers (draft):**
  - "Every disk image, memory dump and log is made up and generated from a written story. Nothing here parses a real image or real memory, and the tools have invented names. Each tool's manual names the real tool it imitates."
  - "It teaches the investigator's workflow, not the internals of any one commercial tool, and it isn't preparation for a certification."
  - "No accounts and no database: progress stays in your own browser."

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Evidence authored by hand drifts out of sync with itself | The generator + consistency test (§5.4, §10) make hand-authoring impossible |
| Beginners get lost in raw evidence | Beginner mode (from Hacker Simulation) suggests the next tool, and the mentor gives hints, not answers |
| Output looks too much like real tools (IP/trademark) | Invented names, output formats written from scratch, real names only in reference text |
| Scope creep (more OSes, more artefacts) | v1 has one Windows-like and one Linux-like machine. Everything else goes in `futureImprovements` |
