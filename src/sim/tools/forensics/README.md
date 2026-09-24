# src/sim/tools/forensics

The examiner's toolset (`docs/plan/04-disk-tools.md`, and files 07 to 09 for the rest). Each one is an ordinary `Tool`: a pure function `(args, state, ctx) => SimResult`, with beginner-first help, typed errors, and one line in `index.ts`.

Three things make these different from the vendored tools:

1. **They read evidence, not the workstation's filesystem.** The evidence a case hands over lives in `state.evidence` (`src/sim/evidence/session.ts`), and appears on the workstation as devices under `/dev/evidence`. `shared.ts` holds everything they need to get at it: `requireEvidence`, `findImage` (a bare id, a device path, or a path to a working copy), and `openImage`, which reads an original the way its write-blocker says it must be read.
2. **Their output lines carry artefact refs.** Every line that shows a piece of evidence sets `OutputLine.ref`, `pin` stores one, and the grader checks it (`docs/plan/02-evidence-model.md` §Artefact refs). `delivered()` also remembers what was printed, which is how `pin` can point back at a line.
3. **Their man pages name the real tools.** `ToolHelp.realWorld` becomes a **REAL-WORLD EQUIVALENT** section in `man`, and it is the only place a real tool's name may appear: `registry.test.ts` bans those names as commands (`docs/plan/99-reference.md` §Simulation framing). Output formats are written from the public descriptions of what those tools report, never copied.

| Tool      | Does                                                              |
| --------- | ----------------------------------------------------------------- |
| `blocker` | Shows each device's write-blocker, and turns one on or off        |
| `acquire` | Images a device into a working copy, and prints MD5 and SHA-256   |
| `hashsum` | Hashes an image, a device or a file; `--verify` says MATCH or not |
| `lsfs`    | Lists file records, deleted ones marked `*`                       |
| `inode`   | One record: path, owner, size, clusters, MACB, cluster reuse      |
| `recover` | Writes a deleted file's content out, while its clusters survive   |
| `pin`     | Puts an output line's artefact on the case board                  |
| `carve`   | Finds files in unallocated space by signature, whole or partial   |
| `strings` | Readable text from an image, a ref, a memory image or a file      |
| `logq`    | Filters log records, or counts them by a field (`--count-by`)     |

Events (`docs/plan/04-disk-tools.md` §Events): `evidence.acquired`, `evidence.hashed`, `evidence.readOriginal`, `evidence.recovered`, `board.pinned`; and from file 07, `evidence.carved` (one per object), `evidence.searched` and `logs.queried`. File 10 builds the chain of custody and the case board from them, so nothing here keeps a second copy.

`browse.ts` is not a tool: it is the Evidence Browser's way in (`docs/plan/05-workspace-ui.md` §Evidence Browser). `browsableImages` lists what can be opened from the session alone, and `browseImage` opens one through `findImage` and `openImage`, so the browser reads an original exactly the way these tools do, write-blocker and all.

**Refs through a pipe** (file 07). `logq … | grep …` must still be pinnable, so the shell sends each line's ref down the pipe beside its text (`ToolContext.stdinRefs`), `grep`, `head` and `tail` keep it on the lines they pass through, and after a pipeline that ran one of these tools `pin` points at what reached the screen. `logq` puts the record's ref on every line of a multi-line record, so whichever line `grep` keeps can be pinned. `VENDORED.md` lists the change.

`carve` and `strings` share the signature table and the carving scan in `src/sim/evidence/magic.ts`, which cites the format specification behind each signature. A carve ref names the offset of an object's first byte in unallocated space; `strings disk:<id>:carve/<offset>` reads one, and `carvedObjectAt` resolves it with the same scan `carve` makes. `strings` exports `memoryStrings`, which `mem strings` (file 08) scopes to one pid.

`__fixtures__/evidence.ts` is the drive every test runs against, built with the evidence builder. `golden.test.ts` holds the committed transcript of a whole pass (`__fixtures__/golden/disk-tools.txt`): never edit that file by hand, delete it and rerun the test after an intentional change to the output. File 07's tools have their own drive and logs in `__fixtures__/carve-logs.ts` (a deleted PDF partly written over, a recoverable ZIP, forty failed logons from one address), their own golden transcript (`carve-logs.golden.test.ts`, `golden/carve-strings-logq.txt`), and the carving differential test in `carve.test.ts`: every carved object is byte-identical to what the builder planted.

Never import here: anything outside `src/sim`.
