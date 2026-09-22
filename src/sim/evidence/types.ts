/**
 * The evidence model (docs/plan/02-evidence-model.md): the shapes every forensics tool, view and
 * case builds on. Evidence is plain JSON data, generated from a written story (file 03) and never
 * edited by hand. Everything here is read-only: a tool that "changes" evidence (mountWrite) returns
 * a new copy.
 */

/** Milliseconds since the Unix epoch, UTC. The same number the vendored `Clock` returns. */
export type Instant = number;

// ---------------------------------------------------------------------------------------------
// Logs

/** Every log source an evidence set can hold. */
export const LOG_SOURCES = [
  "security",
  "sysmon-lite",
  "web-access",
  "firewall",
  "dns",
  "vpn",
] as const;
export type LogSource = (typeof LOG_SOURCES)[number];

/** One log record. `at` is always UTC; a source may *display* local time (EvidenceSet.zones). */
export interface LogRecord {
  /** Sequence number, unique within its source. The ref is `log:<source>/<seq>`. */
  readonly seq: number;
  readonly source: LogSource;
  readonly at: Instant;
  /** The machine that wrote the record, such as "qf-lt-07". */
  readonly host: string;
  /** Windows-style event id, for the `security` and `sysmon-lite` sources. */
  readonly eventId?: number;
  readonly fields: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------------------------
// Disk image

/** MACB times: modified, accessed, changed (the record itself), born. All UTC. */
export interface MacbTimes {
  readonly m: Instant;
  readonly a: Instant;
  readonly c: Instant;
  readonly b: Instant;
}

export interface FileRecord {
  /** MFT-like record number, stable. The ref is `disk:<image>:mft/<record>`. */
  readonly record: number;
  /** Windows-style: "C:\\Users\\dana\\Documents\\inv-0412.pdf". */
  readonly path: string;
  readonly size: number;
  /** Base64, so evidence stays plain JSON. Empty for a directory. */
  readonly contentB64: string;
  readonly times: MacbTimes;
  readonly deleted: boolean;
  /** Allocation. A deleted file is recoverable while none of these are reused. */
  readonly clusters: readonly number[];
  /** Account name. */
  readonly owner: string;
  readonly kind: "file" | "dir";
}

export interface Partition {
  readonly index: number;
  readonly label: string;
  readonly fs: "NTFS-like";
  readonly startSector: number;
  readonly sectors: number;
}

export interface DiskImage {
  /** The device's id, such as "qf-lt-07". Letters, digits, dots, dashes and underscores. */
  readonly id: string;
  /** Made up, printed on the evidence bag. */
  readonly device: { readonly model: string; readonly serial: string };
  readonly sectorSize: 512;
  readonly sectors: number;
  readonly partitions: readonly Partition[];
  readonly records: readonly FileRecord[];
  /** Where carved files hide. A few KB, not megabytes. Carve refs are byte offsets into it. */
  readonly unallocatedB64: string;
  readonly clusterSize: number;
}

// ---------------------------------------------------------------------------------------------
// Memory image

export interface MemoryProcess {
  readonly pid: number;
  readonly ppid: number;
  readonly name: string;
  readonly path: string;
  readonly cmdline: string;
  readonly createdAt: Instant;
  readonly exitedAt?: Instant;
  readonly user: string;
  readonly threads: number;
  /** True: missing from the active process list, so a list walk misses it and a pool scan finds it. */
  readonly unlinked?: boolean;
}

export interface MemoryConnection {
  readonly pid: number;
  readonly proto: "TCPv4" | "UDPv4";
  /** "address:port". */
  readonly local: string;
  readonly remote: string;
  readonly state: "ESTABLISHED" | "LISTENING" | "CLOSE_WAIT" | "SYN_SENT";
  readonly createdAt: Instant;
}

export interface MemoryModule {
  readonly pid: number;
  readonly path: string;
  readonly base: number;
  readonly size: number;
}

export interface MemoryRegion {
  readonly pid: number;
  /** Unique within the image: the ref is `mem:<image>:vad/<base>`. */
  readonly base: number;
  readonly size: number;
  readonly protection:
    "PAGE_READONLY" | "PAGE_READWRITE" | "PAGE_EXECUTE_READ" | "PAGE_EXECUTE_READWRITE";
  /** The file mapped into the region. Absent: private memory, backed by nothing on disk. */
  readonly backedBy?: string;
  readonly previewB64: string;
}

export interface MemoryString {
  readonly offset: number;
  readonly value: string;
  readonly pid?: number;
}

export interface MemoryImage {
  readonly id: string;
  readonly capturedAt: Instant;
  readonly host: string;
  readonly processes: readonly MemoryProcess[];
  /** The ref of a connection is its index here: `mem:<image>:conn/<index>`. */
  readonly connections: readonly MemoryConnection[];
  readonly modules: readonly MemoryModule[];
  readonly regions: readonly MemoryRegion[];
  readonly strings: readonly MemoryString[];
}

// ---------------------------------------------------------------------------------------------
// Evidence set

export interface HandoverItem {
  /** What was handed over, such as "qf-lt-07". */
  readonly item: string;
  readonly hashes?: { readonly md5: string; readonly sha256: string };
  readonly receivedAt: Instant;
  /** Who handed it over. */
  readonly by: string;
}

/** The sources whose display zone an evidence set can set: every log source, plus the disks. */
export type ZonedSource = LogSource | "disk";

export interface EvidenceSet {
  readonly caseId: string;
  readonly seed: number;
  readonly disks: readonly DiskImage[];
  readonly memory: readonly MemoryImage[];
  readonly logs: readonly LogRecord[];
  /**
   * The local zone (an IANA name) a source records its times in, for display. Absent means the
   * source shows UTC. Every zone named here must be in the offset table (time.ts).
   */
  readonly zones: Readonly<Partial<Record<ZonedSource, string>>>;
  readonly handover: readonly HandoverItem[];
}

// ---------------------------------------------------------------------------------------------
// Artefact refs

/**
 * A stable string that names one piece of evidence a player can point at. Tools put it on output
 * lines, `pin` stores it, and the grader checks it (refs.ts).
 */
export type ArtefactRef =
  | `disk:${string}:mft/${number}` // a file record in a disk image
  | `disk:${string}:carve/${number}` // a carved object at a byte offset in unallocated space
  | `mem:${string}:pid/${number}` // a process
  | `mem:${string}:conn/${number}` // a connection (its index)
  | `mem:${string}:vad/${number}` // a suspicious region (its base address)
  | `log:${LogSource}/${number}`; // a log record (its sequence number)

/** An ArtefactRef taken apart. */
export type ParsedRef =
  | { readonly kind: "file"; readonly image: string; readonly record: number }
  | { readonly kind: "carve"; readonly image: string; readonly offset: number }
  | { readonly kind: "process"; readonly image: string; readonly pid: number }
  | { readonly kind: "connection"; readonly image: string; readonly index: number }
  | { readonly kind: "region"; readonly image: string; readonly base: number }
  | { readonly kind: "log"; readonly source: LogSource; readonly seq: number };

/** What a ref points at, found in an evidence set. */
export type ResolvedArtefact =
  | { readonly kind: "file"; readonly disk: DiskImage; readonly file: FileRecord }
  | { readonly kind: "carve"; readonly disk: DiskImage; readonly offset: number }
  | { readonly kind: "process"; readonly image: MemoryImage; readonly process: MemoryProcess }
  | {
      readonly kind: "connection";
      readonly image: MemoryImage;
      readonly index: number;
      readonly connection: MemoryConnection;
    }
  | { readonly kind: "region"; readonly image: MemoryImage; readonly region: MemoryRegion }
  | { readonly kind: "log"; readonly record: LogRecord };
