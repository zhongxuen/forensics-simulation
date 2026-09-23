# src/sim/evidence

The evidence model (`docs/plan/02-evidence-model.md`): the types and pure functions every forensics tool, investigator view and case builds on. Evidence is **plain JSON data**, generated from a written story by file 03's generator and never written by hand. Like the rest of `src/sim`, nothing here reads the clock, draws random numbers, does I/O, or uses `Intl` (`tests/unit/evidence-purity.test.ts`).

Import it from `@/sim` (functions and schemas) and `@/sim/types` (types, plus `LOG_SOURCES`). Tools inside `src/sim` import from `../evidence`.

## The shapes (`types.ts`)

An **`EvidenceSet`** is everything one case hands the player:

| Part       | What it is                                                                                                                                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disks`    | `DiskImage`s: a device (model and serial for the evidence bag), partitions, **file records** (MFT-like record number, Windows path, size, base64 content, **MACB** times, deleted flag, clusters, owner) and a few KB of **unallocated space** where carved files hide |
| `memory`   | `MemoryImage`s: one moment on one host. Processes (an `unlinked` one is missing from the active list, so only a scan finds it), connections, loaded modules, memory regions (protection, what file backs them, a preview) and strings                                  |
| `logs`     | `LogRecord`s from six sources: `security`, `sysmon-lite`, `web-access`, `firewall`, `dns`, `vpn`. `seq` is unique within a source                                                                                                                                      |
| `zones`    | Which sources **display** local time, and in which zone. Absent means UTC. This is the plan's `sourceZone`, per source, plus `disk` for file times                                                                                                                     |
| `handover` | What the client handed over, when, by whom, and the hashes on the form                                                                                                                                                                                                 |

**Every time is an `Instant`**: milliseconds since the Unix epoch, UTC. Zones change only how a time is shown, never the stored value.

## Artefact refs (`refs.ts`)

Every piece of evidence a player can point at has one stable string:

```text
disk:<image>:mft/<record>     a file record          mem:<image>:pid/<pid>      a process
disk:<image>:carve/<offset>   a carved object        mem:<image>:conn/<index>   a connection
log:<source>/<seq>            a log record           mem:<image>:vad/<base>     a memory region
```

`parseRef` and `formatRef` round-trip, and each ref has **one spelling** (decimal, no leading zeros, lowercase ids), so refs compare as strings. `resolveRef(evidence, ref)` returns what the ref points at, or `undefined`. A carve ref resolves when its offset is inside the unallocated space; what's there is for the carver (file 07) to say.

Tools put the ref on the output line that shows the artefact (`OutputLine.ref`, added to the vendored `src/sim/core/types.ts`), `pin` stores it, and the grader checks it.

## Time (`time.ts`)

`formatInstant(ms)` prints UTC, `2026-04-11T19:40:12Z`, exactly like the vendored clock. `formatInstant(ms, { zone: "Europe/London" })` prints local time with its offset, `2026-04-11 20:40:12 +01:00`.

Offsets come from **`ZONE_TABLE`**, a small committed table covering only the case dates (Europe/London, 2026), not from `Intl`, so output never depends on the machine. An instant or zone outside the table throws a `RangeError`: evidence is generated inside it, so that's a bug to fix by adding periods. `tests/unit/evidence-time.test.ts` checks every hour of the table against `Intl.DateTimeFormat`.

## Disk images (`disk.ts`)

- `mountRead(disk)` is a write-blocked read: a view with records in order, `record(n)`, `atPath(path)` (Windows paths ignore case), `children(dir)` and `content(file)`. It changes nothing.
- `mountWrite(disk, at)` is plugging the original into a normal computer: it returns a copy in which every live record's **access time** is `at` (or only the records passed in `{ records }`). Deleted records and every other field are untouched. This is Case 1's wrong turn: the image's hash no longer matches the handover form, which `tests/unit/evidence-image.test.ts` proves.

## Logs (`logs.ts`)

`renderLog(record, { zone? })` returns the lines a source would print, in its native shape, written from the public format descriptions and never copied from a tool:

| Source        | Shape                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `security`    | `EventID` / `TimeCreated` / `Computer` / `Keywords`, then the fields in Microsoft's documented order. Named: 4624, 4625, 4634, 4672, 4688, 4720, 4732 |
| `sysmon-lite` | The same header shape. Named: 1 (process created), 3 (network connection), 11 (file created), 23 (file deleted)                                       |
| `web-access`  | An Apache combined line, `[11/Apr/2026:19:39:58 +0000]`                                                                                               |
| `firewall`    | `<time> <host> action=… proto=… src=… spt=… dst=… dpt=…`, known keys first                                                                            |
| `dns`         | `<time> <host> query A cdn-sync.example from 10.60.1.10 -> NOERROR 203.0.113.47`                                                                      |
| `vpn`         | `<time> <host> vpn[<event>] user=… src=…`                                                                                                             |

An event id with no name still renders, titled "Event.". Every line is a single line, so the vendored shell can pipe it through `grep`. Goldens: `tests/unit/fixtures/evidence-logs/`.

## Schemas (`schema.ts`)

Zod schemas for every type, written with `zod/mini` because the loader runs them in the browser. The generator (Node) uses the same file. Objects are strict (a misspelt key fails), and the schemas also check what keeps refs and tools honest: unique ids, record numbers, pids, region bases and `(source, seq)` pairs; every pid a connection, module, region or string names exists; a file's `size` matches its content; ids fit in a ref; and every display zone is in the offset table. `tests/unit/evidence-schema.test.ts` proves the schemas' output types equal the hand-written ones.

## Image bytes (`image.ts`) and hashes (`hash/`)

`imageBytes(disk)` builds **the one byte layout of a disk image**, and `imageHash(algorithm, disk)` hashes it. Nothing else is ever hashed — not the JSON, not an object — so the game, the generator and the tests always agree on what a disk's hash is:

```text
header        magic "CWIMAGE1", sector size, sectors, cluster size, id, device model, serial
partitions    count, then each partition in index order
records       count, then each record in record-number order: number, path, owner, kind, deleted,
              size, the four MACB times, its clusters, and its content zero-filled to the end of
              its last cluster (the slack space a real file leaves behind)
unallocated   length, then the bytes deleted files and carved objects live in
```

Numbers are little-endian, text is UTF-8 with its byte length in front, and times are IEEE 754 doubles. It is a container, not a sector-by-sector dump: the simulated disks are sparse, and a dump would be gigabytes of zeros. Because the MACB times are in there, `mountWrite` changes the hash. Change the layout and every stored hash changes with it, which is why it carries a version in its magic.

`hash/` holds **MD5, SHA-1 and SHA-256 written out in TypeScript**, over `Uint8Array`, with `hashHex(algorithm, bytes)` for lowercase hex and `toHex` for a raw digest. `src/sim` runs in the browser as well as in Node, so it can use neither `node:crypto` nor Web Crypto (which is asynchronous anyway), and hashing evidence has to be synchronous and identical everywhere. `tests/unit/evidence-hash.test.ts` checks the published RFC 1321 and FIPS 180-4 vectors, 200 seeded random inputs from 0 bytes to 64 KB against `node:crypto`, and the speed: all three hash 256 KB in a couple of milliseconds, against a 50 ms budget.

MD5 and SHA-1 are long broken for security. The game still prints them because evidence forms and older tools do, and says so wherever it shows one.

## The test builder (`builder.ts`)

`build` is a fluent builder for evidence, so a tool test can make a fixture in five lines instead of running the case generator:

```ts
import { build, EvidenceSetSchema } from "@/sim";

const set = build
  .evidence("case-01", { seed: 7 })
  .disk(build.disk("qf-lt-07").file("C:\Users\dana\inv-0412.pdf", { content: "%PDF-1.4" }))
  .memory(build.memory("qf-srv-01").process("svchost.exe", { unlinked: true }))
  .log("security", "2026-04-11T19:40:12Z", { TargetUserName: "dana" }, { eventId: 4624 })
  .build();
```

It fills in everything a test doesn't care about, the same way every time: parent folders and record numbers (from 5), clusters (from 1000), pids (from 1000, in fours), log sequence numbers (per source, from 1), sizes and base64 from the content, and the owner from a user's path. Times are instants or UTC ISO strings (`"2026-04-11T19:42:03Z"`; anything whose zone is a guess is refused), defaulting to `BUILDER_START`. `.deleted(path)` marks a record deleted while leaving its content and clusters where they were, and `.handover(item, { hashes: true })` puts that disk's real MD5 and SHA-256 on the form.

It is a _test_ builder, not the generator: it checks nothing for consistency or solvability (file 03 does that), so what it builds is only as sensible as the test that asked for it. Run `EvidenceSetSchema.parse` when a test wants the shapes checked too. `build` keeps its own namespace because `disk`, `memory` and `evidence` are far too common a set of words to take from the top level of `@/sim`.

## The workstation's evidence (`session.ts`)

`SimState.evidence` is what the disk tools read (`docs/plan/04-disk-tools.md` §How evidence reaches the terminal): the set as it was handed over, the devices it is **attached** to, and the image bytes behind each path a tool can be pointed at.

`attachEvidence(state, set)` lays a device down per disk image under **`/dev/evidence/<id>`**, owned by root, holding a short explanation rather than bytes, so `ls` finds it and `cat` says what it is and what to do instead. Each device has a **write-blocker**, on when evidence arrives: `setBlocker` is what the `blocker` command calls, and `readOriginal` reads the drive the way that flag says. With the blocker on it is `mountRead` and nothing changes; with it off it is `mountWrite`, every live record's access time becomes the time of the read, and the drive's hash moves with them for the rest of the run. Both emit `evidence.readOriginal`, with `blocker` saying which happened.

`withAcquiredImage` registers the working copy `acquire` writes, `pathsForImage` is why a bare id means "the copy I made", and `rememberOutput` keeps the last tool's lines so `pin` can point back at one. None of it is serialized: a saved case run is a replay of a command log, not an engine snapshot (`docs/plan/00-overview.md` §4 row 9), so evidence is attached again when the scenario is built.

## Coming next

File 03 adds the generator in `generate/`, which writes evidence from a written story and checks it for consistency and solvability.
