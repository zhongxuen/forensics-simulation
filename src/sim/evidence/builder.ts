import { encodeBase64 } from "./base64";
import { utf8Bytes } from "./bytes";
import { baseName, parentPath } from "./disk";
import { hashHex } from "./hash";
import { imageBytes } from "./image";
import type {
  DiskImage,
  EvidenceSet,
  FileRecord,
  HandoverItem,
  Instant,
  LogRecord,
  LogSource,
  MacbTimes,
  MemoryConnection,
  MemoryImage,
  MemoryModule,
  MemoryProcess,
  MemoryRegion,
  MemoryString,
  Partition,
  ZonedSource,
} from "./types";

/**
 * A small fluent builder for evidence, so a tool test can make a fixture in five lines instead of
 * running the case generator (docs/plan/02-evidence-model.md §Builder for tests). It fills in
 * everything a test doesn't care about — record numbers, clusters, parent folders, pids, sequence
 * numbers, sizes — and fills them in the same way every time.
 *
 * ```ts
 * const set = evidence("case-01")
 *   .disk(disk("qf-lt-07").file("C:\\Users\\dana\\notes.txt", { content: "pallet wrap" }))
 *   .memory(memory("qf-srv-01").process("svchost.exe", { unlinked: true }))
 *   .log("security", "2026-04-11T19:40:12Z", { TargetUserName: "dana" }, { eventId: 4624 })
 *   .build();
 * ```
 *
 * It is not the generator: it checks nothing for consistency or solvability (file 03 does that),
 * so what it builds is only as sensible as the test that asked for it. A test that wants the
 * shapes checked too can run `EvidenceSetSchema.parse` on the result.
 */

/** Where builder times start when a test doesn't say: 2026-04-10T08:00:00Z, before the cases. */
export const BUILDER_START = Date.UTC(2026, 3, 10, 8, 0, 0);

/** An instant, or a UTC ISO 8601 string such as "2026-04-11T19:42:03Z". */
export type TimeInput = Instant | string;

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;

/** Takes a number as it stands and parses a UTC ISO string. A local-time string is refused. */
export function toInstant(time: TimeInput): Instant {
  if (typeof time === "number") {
    if (!Number.isFinite(time)) throw new RangeError(`not an instant: ${time}`);
    return time;
  }
  if (!ISO_UTC.test(time)) {
    throw new RangeError(`not a UTC ISO time: "${time}". Write it as 2026-04-11T19:42:03Z.`);
  }
  return Date.parse(time);
}

function contentBytes(content: string | Uint8Array): Uint8Array {
  return typeof content === "string" ? utf8Bytes(content) : content;
}

// ---------------------------------------------------------------------------------------------
// Disks

export interface DiskOptions {
  readonly model?: string;
  readonly serial?: string;
  readonly sectors?: number;
  readonly clusterSize?: number;
}

export interface FileOptions {
  readonly content?: string | Uint8Array;
  /** Sets all four MACB times at once. */
  readonly at?: TimeInput;
  /** Overrides single MACB times, after `at`. */
  readonly times?: Partial<Record<keyof MacbTimes, TimeInput>>;
  readonly deleted?: boolean;
  readonly owner?: string;
  readonly record?: number;
  readonly clusters?: readonly number[];
}

export class DiskBuilder {
  private readonly records: FileRecord[] = [];
  private readonly partitions: Partition[] = [];
  private unallocatedBytes: Uint8Array = new Uint8Array(0);
  private nextRecord = 5;
  private nextCluster = 1000;

  constructor(
    private readonly id: string,
    private readonly options: DiskOptions = {},
  ) {}

  /** A folder, and every folder above it that doesn't exist yet. */
  dir(path: string, options: FileOptions = {}): this {
    this.ensureDir(path, options);
    return this;
  }

  /** A file, and every folder above it. Its size and clusters come from its content. */
  file(path: string, options: FileOptions = {}): this {
    const parent = parentPath(path);
    if (parent !== undefined) this.ensureDir(parent);
    const content = contentBytes(options.content ?? "");
    const clusterSize = this.options.clusterSize ?? 4096;
    this.records.push({
      record: options.record ?? this.nextRecord++,
      path,
      size: content.length,
      contentB64: encodeBase64(content),
      times: this.macb(options),
      deleted: options.deleted ?? false,
      clusters: options.clusters ?? this.allocate(Math.ceil(content.length / clusterSize) || 1),
      owner: options.owner ?? ownerOf(path),
      kind: "file",
    });
    return this;
  }

  /**
   * Marks the record at `path` deleted: the record and its clusters stay, so the file is still
   * recoverable until something reuses them. Throws when there is no such record.
   */
  deleted(path: string): this {
    const index = this.records.findLastIndex((r) => samePath(r.path, path));
    const found = this.records[index];
    if (!found) throw new RangeError(`deleted: no record at ${path}`);
    this.records[index] = { ...found, deleted: true };
    return this;
  }

  /** The unallocated space, where deleted content and carved objects are found (file 07). */
  unallocated(content: string | Uint8Array): this {
    this.unallocatedBytes = contentBytes(content);
    return this;
  }

  partition(label: string, options: Partial<Omit<Partition, "label" | "fs">> = {}): this {
    this.partitions.push({
      index: options.index ?? this.partitions.length,
      label,
      fs: "NTFS-like",
      startSector: options.startSector ?? 64,
      sectors: options.sectors ?? (this.options.sectors ?? 2048) - 64,
    });
    return this;
  }

  build(): DiskImage {
    return {
      id: this.id,
      device: {
        model: this.options.model ?? "QX-256 solid-state drive",
        serial: this.options.serial ?? "QX-0000-7731",
      },
      sectorSize: 512,
      sectors: this.options.sectors ?? 2048,
      partitions:
        this.partitions.length > 0
          ? this.partitions
          : [{ index: 0, label: "Windows", fs: "NTFS-like", startSector: 64, sectors: 1984 }],
      records: [...this.records].sort((x, y) => x.record - y.record),
      unallocatedB64: encodeBase64(this.unallocatedBytes),
      clusterSize: this.options.clusterSize ?? 4096,
    };
  }

  private ensureDir(path: string, options: FileOptions = {}): void {
    if (this.records.some((r) => samePath(r.path, path))) return;
    const parent = parentPath(path);
    if (parent !== undefined) this.ensureDir(parent);
    this.records.push({
      record: options.record ?? this.nextRecord++,
      path,
      size: 0,
      contentB64: "",
      times: this.macb(options),
      deleted: options.deleted ?? false,
      clusters: [],
      owner: options.owner ?? ownerOf(path),
      kind: "dir",
    });
  }

  private allocate(count: number): number[] {
    return Array.from({ length: count }, () => this.nextCluster++);
  }

  private macb(options: FileOptions): MacbTimes {
    const all = toInstant(options.at ?? BUILDER_START);
    const times = options.times ?? {};
    const one = (key: keyof MacbTimes): Instant => toInstant(times[key] ?? all);
    return { m: one("m"), a: one("a"), c: one("c"), b: one("b") };
  }
}

/** Starts a disk image. See the example at the top of this file. */
export function disk(id: string, options: DiskOptions = {}): DiskBuilder {
  return new DiskBuilder(id, options);
}

/** "C:\\Users\\dana\\notes.txt" → "dana". Anything outside a user's folder belongs to SYSTEM. */
function ownerOf(path: string): string {
  const user = /^[A-Za-z]:\\Users\\([^\\]+)/.exec(path)?.[1];
  return user !== undefined && !samePath(baseName(path), "Users") ? user : "SYSTEM";
}

function samePath(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// ---------------------------------------------------------------------------------------------
// Memory

export interface MemoryOptions {
  readonly host?: string;
  readonly capturedAt?: TimeInput;
}

export interface ProcessOptions {
  readonly pid?: number;
  readonly ppid?: number;
  readonly path?: string;
  readonly cmdline?: string;
  readonly createdAt?: TimeInput;
  readonly exitedAt?: TimeInput;
  readonly user?: string;
  readonly threads?: number;
  readonly unlinked?: boolean;
}

export interface ConnectionOptions {
  readonly pid?: number;
  readonly proto?: MemoryConnection["proto"];
  readonly local?: string;
  readonly state?: MemoryConnection["state"];
  readonly createdAt?: TimeInput;
}

export interface RegionOptions {
  readonly pid?: number;
  readonly base?: number;
  readonly size?: number;
  readonly protection?: MemoryRegion["protection"];
  readonly backedBy?: string;
  readonly preview?: string | Uint8Array;
}

export class MemoryBuilder {
  private readonly processes: MemoryProcess[] = [];
  private readonly connections: MemoryConnection[] = [];
  private readonly modules: MemoryModule[] = [];
  private readonly regions: MemoryRegion[] = [];
  private readonly strings: MemoryString[] = [];
  private nextPid = 1000;
  private nextBase = 0x200000;
  private nextOffset = 0x10000;
  private lastPid = 0;

  constructor(
    private readonly host: string,
    private readonly options: MemoryOptions = {},
  ) {}

  /** A process. The `connection`, `module`, `region` and `string` calls after it attach to it. */
  process(name: string, options: ProcessOptions = {}): this {
    const pid = options.pid ?? this.nextPid;
    this.nextPid = Math.max(this.nextPid, pid) + 4; // Windows pids are multiples of four
    this.lastPid = pid;
    this.processes.push({
      pid,
      ppid: options.ppid ?? 0,
      name,
      path: options.path ?? `C:\\Windows\\System32\\${name}`,
      cmdline: options.cmdline ?? `C:\\Windows\\System32\\${name}`,
      createdAt: toInstant(options.createdAt ?? this.capturedAt() - 3_600_000),
      user: options.user ?? "SYSTEM",
      threads: options.threads ?? 4,
      ...(options.exitedAt === undefined ? {} : { exitedAt: toInstant(options.exitedAt) }),
      ...(options.unlinked ? { unlinked: true } : {}),
    });
    return this;
  }

  /** An open connection, to "203.0.113.47:443" say, belonging to the process added last. */
  connection(remote: string, options: ConnectionOptions = {}): this {
    this.connections.push({
      pid: options.pid ?? this.lastPid,
      proto: options.proto ?? "TCPv4",
      local: options.local ?? "10.60.1.10:49811",
      remote,
      state: options.state ?? "ESTABLISHED",
      createdAt: toInstant(options.createdAt ?? this.capturedAt() - 60_000),
    });
    return this;
  }

  module(path: string, options: { pid?: number; base?: number; size?: number } = {}): this {
    this.modules.push({
      pid: options.pid ?? this.lastPid,
      path,
      base: options.base ?? 0x7ff00000,
      size: options.size ?? 0x20000,
    });
    return this;
  }

  /** A memory region. Given no protection it is the interesting kind: writable and executable. */
  region(options: RegionOptions = {}): this {
    const base = options.base ?? this.nextBase;
    this.nextBase = Math.max(this.nextBase, base) + 0x10000;
    this.regions.push({
      pid: options.pid ?? this.lastPid,
      base,
      size: options.size ?? 4096,
      protection: options.protection ?? "PAGE_EXECUTE_READWRITE",
      ...(options.backedBy === undefined ? {} : { backedBy: options.backedBy }),
      previewB64: encodeBase64(contentBytes(options.preview ?? "")),
    });
    return this;
  }

  /** A string found in memory, such as an address the attacker's tool left behind. */
  string(value: string, options: { pid?: number; offset?: number } = {}): this {
    const offset = options.offset ?? this.nextOffset;
    this.nextOffset = Math.max(this.nextOffset, offset) + 0x100;
    const pid = options.pid ?? this.lastPid;
    this.strings.push({ offset, value, ...(pid > 0 ? { pid } : {}) });
    return this;
  }

  build(): MemoryImage {
    return {
      id: `${this.host}-mem`,
      capturedAt: this.capturedAt(),
      host: this.host,
      processes: this.processes,
      connections: this.connections,
      modules: this.modules,
      regions: this.regions,
      strings: this.strings,
    };
  }

  private capturedAt(): Instant {
    return toInstant(this.options.capturedAt ?? BUILDER_START);
  }
}

/** Starts a memory image of `host`. Its id is `<host>-mem`. */
export function memory(host: string, options: MemoryOptions = {}): MemoryBuilder {
  return new MemoryBuilder(host, options);
}

// ---------------------------------------------------------------------------------------------
// The whole set

export interface EvidenceOptions {
  readonly seed?: number;
  /** The host a log record names when a call doesn't. */
  readonly host?: string;
}

export interface LogOptions {
  readonly host?: string;
  readonly eventId?: number;
  readonly seq?: number;
}

export interface HandoverOptions {
  readonly receivedAt?: TimeInput;
  readonly by?: string;
  /** `true` takes the hashes of the disk image with this item's id, as a real form would. */
  readonly hashes?: boolean | HandoverItem["hashes"];
}

export class EvidenceBuilder {
  private readonly disks: DiskImage[] = [];
  private readonly memories: MemoryImage[] = [];
  private readonly records: LogRecord[] = [];
  private readonly zones: Partial<Record<ZonedSource, string>> = {};
  private readonly handovers: HandoverItem[] = [];
  private readonly lastSeq = new Map<LogSource, number>();

  constructor(
    private readonly caseId: string,
    private readonly options: EvidenceOptions = {},
  ) {}

  disk(image: DiskImage | DiskBuilder): this {
    this.disks.push(image instanceof DiskBuilder ? image.build() : image);
    return this;
  }

  memory(image: MemoryImage | MemoryBuilder): this {
    this.memories.push(image instanceof MemoryBuilder ? image.build() : image);
    return this;
  }

  /** One log record. Sequence numbers count up per source, from 1. */
  log(
    source: LogSource,
    at: TimeInput,
    fields: Record<string, string>,
    options: LogOptions = {},
  ): this {
    const seq = options.seq ?? (this.lastSeq.get(source) ?? 0) + 1;
    this.lastSeq.set(source, Math.max(seq, this.lastSeq.get(source) ?? 0));
    this.records.push({
      seq,
      source,
      at: toInstant(at),
      host: options.host ?? this.options.host ?? "qf-srv-01",
      ...(options.eventId === undefined ? {} : { eventId: options.eventId }),
      fields,
    });
    return this;
  }

  /** Which zone a source's times are *displayed* in. Stored times are always UTC. */
  zone(source: ZonedSource, zone: string): this {
    this.zones[source] = zone;
    return this;
  }

  handover(item: string, options: HandoverOptions = {}): this {
    const hashes = options.hashes === true ? this.hashesOf(item) : options.hashes || undefined;
    this.handovers.push({
      item,
      ...(hashes ? { hashes } : {}),
      receivedAt: toInstant(options.receivedAt ?? BUILDER_START),
      by: options.by ?? "Quillfen Freight office",
    });
    return this;
  }

  build(): EvidenceSet {
    return {
      caseId: this.caseId,
      seed: this.options.seed ?? 1,
      disks: this.disks,
      memory: this.memories,
      logs: this.records,
      zones: this.zones,
      handover: this.handovers,
    };
  }

  private hashesOf(item: string): HandoverItem["hashes"] {
    const found = this.disks.find((image) => image.id === item);
    if (!found) throw new RangeError(`handover: no disk image called "${item}" has been added yet`);
    const bytes = imageBytes(found);
    return { md5: hashHex("md5", bytes), sha256: hashHex("sha256", bytes) };
  }
}

/** Starts an evidence set. See the example at the top of this file. */
export function evidence(caseId: string, options: EvidenceOptions = {}): EvidenceBuilder {
  return new EvidenceBuilder(caseId, options);
}
