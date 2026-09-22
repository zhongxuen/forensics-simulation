# 04 — Disk tools: acquire, hashsum, lsfs, inode, recover, pin

**Wave 2 · parallel with 03, 05, 13 · 3–4 days**
**Depends on:** 02
**Owns:** `src/sim/tools/forensics/{acquire,hashsum,lsfs,inode,recover,pin,index}.ts` and their tests and man pages, `src/sim/evidence/session.ts`

## Goal

The FTK Imager and Autopsy half of the toolset, running in the vendored terminal on the analyst workstation. Each tool has a made-up name, realistic output written from scratch, a man page with a **"Real-world equivalent"** section, and output lines that carry artefact refs.

## Spec

### How evidence reaches the terminal

`src/sim/evidence/session.ts` extends the vendored `SimState` with `evidence: { set: EvidenceSet; attached: Record<string, AttachedItem>; images: Record<string, DiskImage> }`. Evidence appears on the workstation as **devices**, not files: `/dev/evidence/qf-lt-07` (the original device, which you should never read directly) and, after `acquire`, `/cases/<case>/images/qf-lt-07.img` (your working copy). `ls` and `cat` on those paths print a short, friendly explanation instead of bytes.

A **write-blocker** is a state flag per device: `blocker on <device>` / `blocker off <device>`, shown in the prompt and in `acquire` output. Anything that reads the original device with the blocker off calls `mountWrite`, which changes access times. That's permanent for this run and recorded as an event. The Reset machine button (vendored) brings everything back.

### Tools

| Tool | Usage | Does | Real-world equivalent (man page) |
|---|---|---|---|
| `acquire` | `acquire <device> --out <path>` | Images a device, prints progress in sectors, then MD5 + SHA-256 of `imageBytes`. Refuses with a plain explanation if `--out` is on the evidence device. Warns (doesn't refuse) with the blocker off | FTK Imager → File → Create Disk Image; `dd`, `dcfldd`, `ewfacquire` |
| `hashsum` | `hashsum [-a md5\|sha1\|sha256] <image\|device\|file>` | Hashes image bytes or one file's content. `--verify <expected>` prints MATCH or MISMATCH, plus what that means | FTK Imager → Verify Drive/Image; `md5sum`, `sha256sum`, `Get-FileHash` |
| `lsfs` | `lsfs <image> [path] [-r] [-d] [-l]` | Lists records. `-d` deleted only, marked `*`. `-l` shows record number, size, owner, MACB in UTC | The Sleuth Kit `fls`; Autopsy file view |
| `inode` | `inode <image> <record>` | Everything about one record: path, size, owner, MACB with zone note, clusters, deleted flag, whether its clusters are reused | The Sleuth Kit `istat`; Autopsy metadata tab |
| `recover` | `recover <image> <record> --out <path>` | Writes a deleted file's content to the workstation if none of its clusters are reused. Otherwise explains overwriting in one sentence | Autopsy "Extract File"; The Sleuth Kit `icat` |
| `pin` | `pin [n] [-m "note"]` | Pins line *n* of the last output (default: the last line with a ref) to the case board. Lines without a ref get "There's nothing on that line to pin. Pin a line that names a file, record, process or log entry." | Autopsy "Tag file" / bookmarks |

Output rules: every line that shows an artefact sets `ref`. Times are UTC with a `Z`, unless `--zone local` is passed. Every tool gets a beginner-mode explainer line per error code and a "what just happened?" entry, following the vendored beginner-mode pattern.

### Events

Tools emit typed events on the vendored event stream: `evidence.acquired`, `evidence.hashed`, `evidence.readOriginal` (with `blocker: boolean`), `evidence.recovered`, `board.pinned`. File 10 builds the custody log from these, and 03's objectives detect them. Don't store any of this anywhere else.

### Names

The registry test bans real tool names as command names (`volatility`, `autopsy`, `ftkimager`, `fls`, `istat`, `icat`, `photorec`, `foremost`, `dd`, `log2timeline`, `plaso`). They may appear in man-page "Real-world equivalent" text only.

## Prompt 04.1 — disk tools

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md and docs/plan/04-disk-tools.md.
Read the vendored src/sim/tools/ framework (registry, args, help, one existing command) and
src/features/terminal/beginner/ to match their patterns exactly.

You own only the paths listed under "Owns" in 04. Other agents are writing the generator (03) and
UI (05) at the same time, so use the builder from src/sim/evidence/builder.ts for every fixture.

1. Add src/sim/evidence/session.ts (the state extension, devices, write-blocker, blocker command).
2. Write acquire, hashsum, lsfs, inode, recover and pin as specified, one file each, registered in
   src/sim/tools/forensics/index.ts, each with a man page that has a "Real-world equivalent" section,
   beginner explainer lines for every error, and output lines carrying refs.
3. Emit the events in 04 §Events.
4. Extend the registry test's banned-name list with the names in 04 §Names.
5. Tests: unit tests per tool (happy path, every error, refs present), a golden transcript of
   acquire → hashsum --verify → lsfs -d → inode → recover → pin, and one proving that reading the
   original with the blocker off changes the SHA-256 and emits evidence.readOriginal{blocker:false}.
Output formats are written by you from the public descriptions, never copied from a real tool.
Finish with pnpm lint, pnpm typecheck and pnpm test green, then commit.
```

## Done when

- [ ] The golden transcript is stable across runs
- [ ] `man acquire` and every other page shows a "Real-world equivalent" section
- [ ] Every error has a beginner explainer line that follows the error template in 99 §Voice
- [ ] A command named `fls` or `volatility` fails the registry test
