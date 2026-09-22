# 08 — Memory tools: `mem ps`, `psscan`, `pstree`, `netscan`, `cmdline`, `malfind`

**Wave 4 · parallel with 07, 09, 10 · 3–4 days**
**Depends on:** 02, 03 (for `run-process`, `inject`, `connect` actions), 04 (session)
**Owns:** `src/sim/tools/forensics/mem/**` + tests + man pages

## Goal

The Volatility half of the toolset. One `mem` command with subcommands, run against a memory image attached to the case. The teaching moments: a process one list misses and another finds, a parent that makes no sense, a connection that repeats every minute, and memory that is both writable and executable.

## Spec

| Subcommand | Does | Teaches | Real-world equivalent |
|---|---|---|---|
| `mem info <image>` | Host, capture time (UTC + zone), process count | What a memory image is, and that it's a snapshot of one moment | Volatility 3 `windows.info` |
| `mem ps <image>` | Walks the active process list: pid, ppid, name, created, user. **Skips `unlinked` processes** | A list can be tampered with | `windows.pslist` |
| `mem psscan <image>` | Finds every process, including unlinked and exited ones, marked `unlinked` / `exited` | Scan, don't trust the list | `windows.psscan` |
| `mem pstree <image>` | Indented tree by ppid | Parents matter: `svchost.exe` should have `services.exe` as its parent | `windows.pstree` |
| `mem netscan <image> [--pid n]` | proto, local, remote, state, pid, owner name, created | Which process talks to where | `windows.netscan` |
| `mem cmdline <image> [--pid n]` | Full command lines | Arguments give things away (encoded commands, odd paths) | `windows.cmdline` |
| `mem malfind <image> [--pid n]` | `PAGE_EXECUTE_READWRITE` regions **not backed by a file**, with a 64-byte hex/ASCII preview | Injected code looks like this. Also: not every RWX region is evil (the generator plants one harmless one, a JIT runtime) | `windows.malfind` |
| `mem strings <image> [--pid n]` | Alias of `strings` from 07, scoped to a pid | — | `strings` + `windows.vadinfo` |

A `mem diff ps psscan` convenience is **not** added: the player should compare the two lists (the Timeline and Board help). Every line carries a `mem:` ref. Man pages say that these outputs are a teaching model: real memory analysis reads raw structures that differ by OS build.

Emit `memory.listed`, `memory.scanned`, `memory.inspected` events.

Also add `mem` to the Evidence Browser (05) as a **Processes** tab: a sortable table of `psscan` results with a column "in active list?". That's one component file in `src/features/evidence-browser/memory/`, registered in the browser's tab list. Coordinate with 05's ownership by adding only that folder and one line.

## Prompt 08.1

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md and docs/plan/08-memory-tools.md.
Match the patterns of src/sim/tools/forensics/ from file 04.

You own src/sim/tools/forensics/mem/** and src/features/evidence-browser/memory/**, plus one
registration line in src/sim/tools/forensics/index.ts and one in the Evidence Browser's tab list.
Agents are building carve/strings/logq (07), the timeline (09) and the case board (10) at the same
time.

Build `mem` with the subcommands in 08, man pages with "Real-world equivalent" and the teaching-model
note, beginner explainer lines, refs on every line, the events, and the Processes tab. If `strings`
from 07 isn't merged yet, make `mem strings` print a friendly "not available yet" and leave a TODO
naming file 07.
Tests: a builder fixture with an unlinked process, a svchost.exe whose parent is explorer.exe, a
beaconing connection, one malicious RWX region and one harmless JIT region. Golden transcript of
info → ps → psscan → pstree → netscan → cmdline → malfind.
Finish with pnpm lint, pnpm typecheck and pnpm test green, then commit.
```

## Done when

- [ ] The unlinked process appears in `psscan` and not in `ps`, in both the terminal and the Processes tab
- [ ] `malfind` shows both RWX regions, and the man page explains how to tell them apart
