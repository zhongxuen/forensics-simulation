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
- `mountWrite(disk, at)` is plugging the original into a normal computer: it returns a copy in which every live record's **access time** is `at` (or only the records passed in `{ records }`). Deleted records and every other field are untouched. This is Case 1's wrong turn: the image's hash no longer matches the handover form (prompt 02.2 adds `imageBytes` and the hashes that prove it).

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

## Coming next

Prompt 02.2 adds `imageBytes(disk)` (the one byte layout every hash is taken of), pure MD5 / SHA-1 / SHA-256 in `hash/`, and a fluent test builder (`builder.ts`) with examples here. File 03 adds the generator in `generate/`.
