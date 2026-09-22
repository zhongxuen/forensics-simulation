# 02 — Evidence model: disk, memory, logs, hashes, artefact refs

**Wave 1 · alone · 3–4 days**
**Depends on:** 01
**Owns:** `src/sim/evidence/**`, `tests/unit/evidence-*.test.ts`

## Goal

The pure TypeScript types and functions that every tool, view and case builds on. After this file, the rest of the plan can run in parallel, because everyone agrees on these shapes.

## Spec

### Time

`type Instant = number` (ms since the Unix epoch, UTC), from the vendored `src/sim/core/clock.ts`. Each evidence set also has `sourceZone: string` (an IANA name such as `Europe/London`) for sources that record local time. `formatInstant(ms, { zone })` renders either UTC (`2026-03-02T09:00:00Z`) or zoned (`2026-03-02 10:00:00 +01:00`). Zone offsets come from a **small, committed offset table** covering only the case dates, not from `Intl`, so output never depends on the machine. Test: the table agrees with `Intl.DateTimeFormat` for every entry (tests may use `Intl`, the engine may not).

### Artefact refs

Every piece of evidence a player can point at has a stable, string ref:

```ts
type ArtefactRef =
  | `disk:${string}:mft/${number}`            // a file record in a disk image
  | `disk:${string}:carve/${number}`          // a carved object at a byte offset
  | `mem:${string}:pid/${number}`             // a process
  | `mem:${string}:conn/${number}`            // a connection (index)
  | `mem:${string}:vad/${number}`             // a suspicious region (base address)
  | `log:${LogSource}/${number}`;             // a log record (sequence number)
```

`parseRef` / `formatRef` round-trip, and `resolveRef(evidence, ref)` returns the artefact or `undefined`. The vendored `OutputLine` gets an optional `ref?: ArtefactRef` field (note the change in `VENDORED.md`). Tools set it, `pin` reads it, the grader checks it.

### Disk image

```ts
interface FileRecord {
  record: number;              // MFT-like record number, stable
  path: string;                // Windows-style: "C:\\Users\\dana\\Documents\\inv-0412.pdf"
  size: number;
  contentB64: string;          // base64, so evidence stays plain JSON
  times: { m: Instant; a: Instant; c: Instant; b: Instant };   // MACB, UTC
  deleted: boolean;
  clusters: number[];          // allocation; a deleted file is recoverable while none are reused
  owner: string;               // account name
  kind: "file" | "dir";
}
interface Partition { index: number; label: string; fs: "NTFS-like"; startSector: number; sectors: number }
interface DiskImage {
  id: string;                  // "qf-lt-07"
  device: { model: string; serial: string };  // made up, printed on the evidence bag
  sectorSize: 512;
  sectors: number;
  partitions: Partition[];
  records: FileRecord[];
  unallocatedB64: string;      // where carved files hide; a few KB, not megabytes
  clusterSize: number;
}
```

`imageBytes(disk): Uint8Array` builds **one deterministic byte layout** of the image (a header, the partition table, each record's clusters, unallocated space). Hashes are always of these bytes. Nothing else is ever hashed, so the game, the generator and the tests agree.

`mountRead(disk)` returns a read view. `mountWrite(disk, at)` returns a copy whose accessed files get new `a` times: this is what reading without a write-blocker does in Case 1.

### Memory image

```ts
interface MemoryImage {
  id: string;
  capturedAt: Instant;
  host: string;
  processes: { pid: number; ppid: number; name: string; path: string; cmdline: string;
               createdAt: Instant; exitedAt?: Instant; user: string; threads: number;
               unlinked?: boolean }[];   // true: missing from the active list, found by scanning
  connections: { pid: number; proto: "TCPv4" | "UDPv4"; local: string; remote: string;
                 state: "ESTABLISHED" | "LISTENING" | "CLOSE_WAIT" | "SYN_SENT"; createdAt: Instant }[];
  modules: { pid: number; path: string; base: number; size: number }[];
  regions: { pid: number; base: number; size: number;
             protection: "PAGE_READONLY" | "PAGE_READWRITE" | "PAGE_EXECUTE_READ" | "PAGE_EXECUTE_READWRITE";
             backedBy?: string; previewB64: string }[];
  strings: { offset: number; value: string; pid?: number }[];
}
```

(`hidden` in the old plan is now `unlinked`, the real mechanism: the process is unlinked from the active process list, so a list walk misses it and a pool scan finds it.)

### Logs

```ts
type LogSource = "security" | "sysmon-lite" | "web-access" | "firewall" | "dns" | "vpn";
interface LogRecord { seq: number; source: LogSource; at: Instant; host: string;
                      eventId?: number; fields: Record<string, string>; }
```

`renderLog(record)` prints each source in its native shape: a Windows Security event (4624, 4625, 4634, 4672, 4688, 4720, 4732) as `EventID / TimeCreated / fields`, `web-access` as an Apache combined line, `firewall` as a key=value line, `dns` as a query line. Formats are written from the public specs, not copied from tool output. Each record's `at` is UTC. A source may **display** local time when its `EvidenceSet.zones[source]` says so: that's the Case 2 time-zone lesson.

### Evidence set

```ts
interface EvidenceSet {
  caseId: string;
  seed: number;
  disks: DiskImage[];
  memory: MemoryImage[];
  logs: LogRecord[];
  zones: Partial<Record<LogSource | "disk", string>>;
  handover: { item: string; hashes?: { md5: string; sha256: string }; receivedAt: Instant; by: string }[];
}
```

Zod schemas for all of the above live in `src/sim/evidence/schema.ts`, used by the generator and by the loader. The browser uses `zod/mini`.

### Pure hashes

`src/sim/evidence/hash/`: `md5`, `sha1`, `sha256` over `Uint8Array`, written in TypeScript (no dependencies). Tests: the FIPS 180-4 / RFC 1321 test vectors, plus a **differential test** of 200 seeded random inputs (0 bytes to 64 KB) against `node:crypto`. Performance: hashing a 256 KB image takes under 50 ms in Node.

### Builder for tests

`src/sim/evidence/builder.ts`: a small fluent builder (`disk("x").file(path, {…}).deleted(path)…`) so tool tests in 04, 07, 08 and 09 can make fixtures in code without the generator.

## Prompt 02.1 — types, refs, time, logs

```text
Read CLAUDE.md, docs/plan/00-overview.md, docs/plan/99-reference.md and
docs/plan/02-evidence-model.md. Read the relevant guide in node_modules/next/dist/docs/ only if you
touch Next.js (you shouldn't need to).

Build 02 §Time, §Artefact refs, §Disk image (types, mountRead, mountWrite), §Memory image, §Logs
(types and renderLog for every listed source and event id), §Evidence set and the Zod schemas, in
src/sim/evidence/. Add the optional ref field to OutputLine in the vendored src/sim/types.ts and note
it in VENDORED.md. Everything is pure: no Date.now, no Math.random, no node: imports, no Intl in
src/sim. Unit tests for parse/format/resolve of refs, zone formatting against the offset table
(checked against Intl in the test), mountWrite changing only access times, and one golden rendering
per log event id. Add a README.md in src/sim/evidence/ describing the model.
Finish with pnpm lint, pnpm typecheck and pnpm test green, then commit.
```

## Prompt 02.2 — image bytes, pure hashes, builder

Can run in parallel with 02.1 if you give it its own worktree. It only needs the `DiskImage` type, so write that first in 02.1 and merge, or let 02.2 stub it.

```text
Read docs/plan/00-overview.md and docs/plan/02-evidence-model.md.
1. Write md5, sha1 and sha256 over Uint8Array in pure TypeScript in src/sim/evidence/hash/, with
   the FIPS 180-4 and RFC 1321 test vectors and a differential test of 200 seeded random inputs
   (0 B to 64 KB) against node:crypto (tests may import node:crypto; src/sim may not). Add a timing
   check: 256 KB in under 50 ms.
2. Write imageBytes(disk) as the single deterministic byte layout described in 02 §Disk image, with a
   test that the same image always gives the same bytes and that changing any access time changes the
   bytes.
3. Write the test builder in src/sim/evidence/builder.ts, with examples in its README section.
Finish with pnpm lint, pnpm typecheck and pnpm test green, then commit.
```

## Done when

- [ ] Every type in this file exists, with a Zod schema, and `src/sim` still passes its purity lint
- [ ] Hashes match `node:crypto` on every differential input
- [ ] `mountWrite` then `imageBytes` gives a different SHA-256 than `mountRead`. That's Case 1's wrong turn, proven in a test
- [ ] Tool authors in wave 2 can build a fixture in five lines with the builder
