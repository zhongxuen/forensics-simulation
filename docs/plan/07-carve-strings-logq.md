# 07 — Carving, strings and log queries

**Wave 4 · parallel with 08, 09, 10 · 3–4 days**
**Depends on:** 02, 03 (fixtures), 04 (session)
**Owns:** `src/sim/tools/forensics/{carve,strings,logq}.ts` + tests + man pages, `src/sim/evidence/magic.ts`

## Goal

The tools Case 2 needs: find files in unallocated space by their first bytes, pull readable text out of anything, and filter logs.

## Spec

| Tool | Usage | Does | Real-world equivalent |
|---|---|---|---|
| `carve` | `carve <image> [--type pdf,zip,jpg,png] [--out dir]` | Scans `unallocatedB64` for signatures (`%PDF-` … `%%EOF`, `PK\x03\x04` … end of central directory, `\xFF\xD8\xFF` … `\xFF\xD9`, `\x89PNG\r\n\x1a\n` … `IEND`). Prints offset, type, size, and a ref `disk:<id>:carve/<offset>`. Explains that carved files have **no name and no timestamps**, because those lived in the file record | PhotoRec, Foremost, Autopsy carving module |
| `strings` | `strings [-n 4] [-o] <image\|file\|carve-ref\|mem-image>` | Printable ASCII/UTF-16LE runs with offsets. On a memory image, lines carry the owning pid's ref when known | `strings`, `bstrings`, Autopsy "Strings" |
| `logq` | `logq [--source s] [--id n] [--from t] [--to t] [--where field=value] [--zone utc\|local] [--count-by field]` | Filters log records, prints each in its native shape (from `renderLog`) with its ref. `--count-by` gives a small table (this is where a burst of failed logons shows up) | Windows Event Viewer filters, `grep`, a SIEM query |

`src/sim/evidence/magic.ts`: the signature table with a citation per entry (the format specifications: ISO 32000 for PDF, the PKWARE APPNOTE for ZIP, JFIF/ITU T.81 for JPEG, the PNG spec). Differential test: every carved object from a fixture is byte-identical to the file the builder put there.

Pipes still work: `logq --source security --id 4625 | grep 10.60.0.21`. Output stays line-based so the vendored shell can pipe it, and lines keep their refs through `grep` (check the vendored pipe keeps `ref`; if it doesn't, make the smallest change and note it in `VENDORED.md`).

Emit `evidence.carved`, `evidence.searched`, `logs.queried` events.

## Prompt 07.1

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md and
docs/plan/07-carve-strings-logq.md. Match the patterns of the disk tools in
src/sim/tools/forensics/ from file 04.

You own only the paths under "Owns" in 07; agents are building memory tools (08), the timeline (09)
and the case board (10) at the same time. Register your tools with one line each in
src/sim/tools/forensics/index.ts.

Build magic.ts with citations, carve, strings and logq as specified, with man pages ("Real-world
equivalent"), beginner explainer lines, refs on every artefact line, and the events. Make sure refs
survive a pipe through grep. Tests: per-tool units, the carving differential test, a golden
transcript for a fixture with a deleted-and-partly-overwritten PDF, a recoverable ZIP and 40 failed
logons from one address.
Finish with pnpm lint, pnpm typecheck and pnpm test green, then commit.
```

## Done when

- [ ] Carved objects are byte-identical to what the builder planted
- [ ] `logq … | grep …` output can still be pinned
- [ ] The failed-logon burst is visible in one `--count-by` command
