import type { Rng } from "../../core/rng";
import { utf8Bytes } from "../bytes";
import { baseName, parentPath } from "../disk";
import { isKnownZone } from "../time";
import type { HandoverItem, Instant, LogSource, MacbTimes, MemoryImage, Partition } from "../types";
import { BASELINE_IDS, getBaseline, type Baseline } from "./baselines";
import {
  GenerateError,
  type CaseSpec,
  type MachineSpec,
  type PendingArtefact,
  type PendingLog,
  type StoryAction,
} from "./types";

/**
 * The world the story is played in: one mutable state per machine, plus the log records and
 * handover forms the run collects. It exists only while `generate` runs, and every action in
 * `actions/` changes it through the helpers here, so file times, cluster allocation, account
 * checks and logon ids work the same way whichever action asks.
 *
 * Nothing here reads a clock or draws an unseeded random number: every made-up detail comes from
 * `world.rng`, which the case's seed starts.
 */

// ---------------------------------------------------------------------------------------------
// Machines and their disks

/** A file record while the story is still being played. Frozen into a `FileRecord` at the end. */
export interface FileEntry {
  record: number;
  path: string;
  content: Uint8Array;
  times: { m: Instant; a: Instant; c: Instant; b: Instant };
  deleted: boolean;
  clusters: number[];
  owner: string;
  kind: "file" | "dir";
  /** Where this record's content went when it was deleted, so overwriting can reach it again. */
  unallocatedOffset?: number;
  unallocatedChunk?: number;
}

export interface DiskState {
  readonly id: string;
  readonly device: { model: string; serial: string };
  readonly sectors: number;
  readonly clusterSize: number;
  readonly partitions: Partition[];
  readonly records: FileEntry[];
  /** The bytes deleted content and carved objects live in, in the order they were freed. */
  readonly unallocated: Uint8Array[];
  unallocatedLength: number;
  nextRecord: number;
  nextCluster: number;
  readonly removable: boolean;
}

export interface ProcessEntry {
  readonly pid: number;
  readonly ppid: number;
  readonly name: string;
  readonly path: string;
  readonly cmdline: string;
  readonly createdAt: Instant;
  exitedAt?: Instant;
  readonly user: string;
  readonly threads: number;
  unlinked?: boolean;
  /** The index of the action that started it, so a memory capture can credit that action. */
  readonly origin: number;
}

export interface ConnectionEntry {
  readonly pid: number;
  readonly proto: "TCPv4" | "UDPv4";
  readonly local: string;
  readonly remote: string;
  state: "ESTABLISHED" | "LISTENING" | "CLOSE_WAIT" | "SYN_SENT";
  readonly createdAt: Instant;
  readonly origin: number;
}

export interface ModuleEntry {
  readonly pid: number;
  readonly path: string;
  readonly base: number;
  readonly size: number;
}

export interface RegionEntry {
  readonly pid: number;
  readonly base: number;
  readonly size: number;
  readonly protection:
    "PAGE_READONLY" | "PAGE_READWRITE" | "PAGE_EXECUTE_READ" | "PAGE_EXECUTE_READWRITE";
  readonly backedBy?: string;
  readonly preview: Uint8Array;
  readonly origin: number;
}

export interface AccountState {
  readonly name: string;
  readonly groups: Set<string>;
  readonly home: string;
  /** The logon id the security log uses while this account is signed in, such as "0x3f21a". */
  logonId?: string;
  /** How it signed in last, so the logoff record can say the same. */
  logonType?: string;
}

export interface MachineState {
  readonly spec: MachineSpec;
  readonly baseline: Baseline;
  readonly id: string;
  readonly zone: string;
  readonly ip: string;
  /** How far ahead this machine's clock runs, in minutes (`clock-skew`). */
  skewMinutes: number;
  /** Undefined for a machine that is never imaged, such as the analyst's workstation. */
  readonly disk?: DiskState;
  readonly accounts: Map<string, AccountState>;
  readonly processes: ProcessEntry[];
  readonly connections: ConnectionEntry[];
  readonly modules: ModuleEntry[];
  readonly regions: RegionEntry[];
  /** Removable drives plugged in, by drive letter. */
  readonly volumes: Map<string, DiskState>;
  nextPid: number;
  /** The process a `connect` or `inject` means when it doesn't name one. */
  lastPid: number;
  nextRegionBase: number;
  nextLogonId: number;
}

export interface World {
  readonly spec: CaseSpec;
  readonly rng: Rng;
  readonly machines: Map<string, MachineState>;
  /** Every machine's disk, plus removable drives, by id. */
  readonly disks: Map<string, DiskState>;
  readonly logs: PendingLog[];
  readonly memory: MemoryImage[];
  readonly handover: HandoverItem[];
  /** What each handed-over disk hashed to when the form was signed, to catch a later change. */
  readonly handoverHashes: Map<string, string>;
  /** When the story starts, so baselines can be aged backwards from it. */
  readonly startsAt: Instant;
  nextLogKey: number;
}

/** What an action is given. One action, one file in `actions/`, one test. */
export interface ActionContext {
  readonly world: World;
  readonly machine: MachineState;
  readonly action: StoryAction;
  /** The true instant, UTC. */
  readonly at: Instant;
  /** The time this machine believes it is, which is what it writes on things. */
  readonly recorded: Instant;
  readonly index: number;
  readonly rng: Rng;
  /** Where we are, for error messages: `story[4] delete-file on qf-lt-07`. */
  readonly where: string;
  /** Writes a log record and notes the artefact against this action. */
  log(source: LogSource, fields: Record<string, string>, options?: LogOptions): void;
  /** Notes an artefact against this action, for the consistency tests. */
  note(artefact: PendingArtefact): void;
  /**
   * Notes an artefact against an *earlier* action. A memory capture uses it: the process it finds
   * belongs to the `run-process` beat that started it, not to the capture.
   */
  noteFor(index: number, artefact: PendingArtefact): void;
  /** Stops the build with a message an author can act on. */
  fail(message: string): never;
}

export interface LogOptions {
  readonly eventId?: number;
  readonly host?: string;
  /** The instant to record, if not this machine's idea of now. */
  readonly at?: Instant;
  /** What to call it in the trace. Defaults to the source and event id. */
  readonly what?: string;
}

// ---------------------------------------------------------------------------------------------
// Building the world

const DAY = 86_400_000;
const MINUTE = 60_000;

/**
 * The clean machines a story starts from. Every baseline file is aged backwards from the first
 * story action, with a few seeded minutes of jitter so a folder isn't a wall of identical times.
 */
export function createWorld(spec: CaseSpec, rng: Rng, startsAt: Instant): World {
  const world: World = {
    spec,
    rng,
    machines: new Map(),
    disks: new Map(),
    logs: [],
    memory: [],
    handover: [],
    handoverHashes: new Map(),
    startsAt,
    nextLogKey: 1,
  };

  spec.machines.forEach((machineSpec, index) => {
    const baseline = getBaseline(machineSpec.baseline);
    if (!baseline) {
      throw new GenerateError(
        `there is no baseline called "${machineSpec.baseline}". The baselines are: ${BASELINE_IDS.join(", ")}.`,
        `machines[${machineSpec.id}]`,
      );
    }
    if (baseline.kind !== machineSpec.kind) {
      throw new GenerateError(
        `kind is "${machineSpec.kind}", but the baseline ${baseline.id} builds a ${baseline.kind}.`,
        `machines[${machineSpec.id}]`,
      );
    }
    if (!isKnownZone(machineSpec.zone)) {
      throw new GenerateError(
        `the offset table has no zone "${machineSpec.zone}". Add it to src/sim/evidence/time.ts, or use UTC.`,
        `machines[${machineSpec.id}]`,
      );
    }
    if (world.machines.has(machineSpec.id)) {
      throw new GenerateError(`two machines are called "${machineSpec.id}".`, "machines");
    }
    world.machines.set(machineSpec.id, buildMachine(world, machineSpec, baseline, index));
  });

  return world;
}

function buildMachine(
  world: World,
  spec: MachineSpec,
  baseline: Baseline,
  index: number,
): MachineState {
  const { rng } = world;
  const disk: DiskState | undefined = baseline.imaged
    ? {
        id: spec.id,
        device: {
          model: spec.device?.model ?? baseline.device.model,
          serial: spec.device?.serial ?? makeSerial(rng, baseline.device.serialPrefix),
        },
        sectors: baseline.sectors,
        clusterSize: baseline.clusterSize,
        partitions: baseline.partitions.map((partition, i) => ({
          index: i,
          label: partition.label,
          fs: "NTFS-like" as const,
          startSector: partition.startSector,
          sectors: partitionSectors(baseline, i),
        })),
        records: [],
        unallocated: [],
        unallocatedLength: 0,
        nextRecord: 5,
        nextCluster: 1000,
        removable: false,
      }
    : undefined;

  const machine: MachineState = {
    spec,
    baseline,
    id: spec.id,
    zone: spec.zone,
    ip: spec.ip ?? `${baseline.network.subnet}.${baseline.network.firstHost + index}`,
    skewMinutes: 0,
    ...(disk ? { disk } : {}),
    accounts: new Map(),
    processes: [],
    connections: [],
    modules: [],
    regions: [],
    volumes: new Map(),
    nextPid: 1000,
    lastPid: 0,
    nextRegionBase: 0x2000000,
    nextLogonId: 0x30000,
  };
  if (disk) world.disks.set(disk.id, disk);

  for (const account of baseline.accounts) {
    addAccount(machine, account.name, account.groups ?? [], account.home);
  }
  for (const name of spec.accounts ?? []) addAccount(machine, name, ["Users"]);

  if (disk) {
    for (const file of baseline.files) {
      const at = agedTime(world, file.agedDays ?? 200, rng);
      ensurePath(disk, file.path, {
        at,
        owner: file.owner ?? "SYSTEM",
        kind: file.kind ?? "file",
        content: file.content,
      });
    }
    for (const account of machine.accounts.values()) {
      for (const file of baseline.homeFiles) {
        const path =
          file.path === "~" ? account.home : `${account.home}\\${file.path.replace(/^~\\/, "")}`;
        const at = agedTime(world, file.agedDays ?? 200, rng);
        ensurePath(disk, path, {
          at,
          owner: account.name,
          kind: file.kind ?? "file",
          content: file.content,
        });
      }
    }
  }

  const primary = primaryAccount(machine);
  for (const process of baseline.processes) {
    const createdAt = world.startsAt - (process.startedMinutesBefore ?? 120) * MINUTE;
    const parent = machine.processes.find((p) => p.name === process.parent);
    machine.processes.push({
      pid: machine.nextPid,
      ppid: parent?.pid ?? 0,
      name: process.name,
      path: process.path ?? `C:\\Windows\\System32\\${process.name}`,
      cmdline: process.cmdline ?? process.path ?? `C:\\Windows\\System32\\${process.name}`,
      createdAt,
      user: process.user ?? primary,
      threads: process.threads ?? 4,
      origin: -1,
    });
    machine.nextPid += 4; // Windows pids are multiples of four
  }
  return machine;
}

function partitionSectors(baseline: Baseline, index: number): number {
  const here = baseline.partitions[index];
  const next = baseline.partitions[index + 1];
  if (!here) return 0;
  return (next ? next.startSector : baseline.sectors) - here.startSector;
}

/** A device serial that looks stamped on a drive, made up from the case's seed. */
export function makeSerial(rng: Rng, prefix: string): string {
  const digits = () => String(rng.int(0, 9999)).padStart(4, "0");
  return `${prefix}-${digits()}-${digits()}`;
}

/** `days` before the story started, give or take a couple of hours, so times aren't identical. */
function agedTime(world: World, days: number, rng: Rng): Instant {
  return world.startsAt - days * DAY - rng.int(0, 7200) * 1000;
}

/** The account a baseline process belongs to when it doesn't say: the machine's own user. */
export function primaryAccount(machine: MachineState): string {
  const named = machine.spec.accounts?.[0];
  if (named !== undefined) return named;
  const first = [...machine.accounts.values()][0];
  return first?.name ?? "SYSTEM";
}

export function addAccount(
  machine: MachineState,
  name: string,
  groups: readonly string[] = [],
  home?: string,
): AccountState {
  const existing = machine.accounts.get(name.toLowerCase());
  if (existing) {
    for (const group of groups) existing.groups.add(group);
    return existing;
  }
  const account: AccountState = {
    name,
    groups: new Set(groups),
    home: home ?? `C:\\Users\\${name}`,
  };
  machine.accounts.set(name.toLowerCase(), account);
  return account;
}

// ---------------------------------------------------------------------------------------------
// Looking things up

export function machineOf(world: World, id: string, where: string): MachineState {
  const machine = world.machines.get(id);
  if (!machine) {
    throw new GenerateError(
      `there is no machine called "${id}" in this case. The machines are: ${[...world.machines.keys()].join(", ")}.`,
      where,
    );
  }
  return machine;
}

/** The machine's own disk image, or a clear complaint if it has none. */
export function diskOf(machine: MachineState, where: string): DiskState {
  if (!machine.disk) {
    throw new GenerateError(
      `${machine.id} is built from ${machine.baseline.id}, which is never imaged, so it has no files to change.`,
      where,
    );
  }
  return machine.disk;
}

export function accountOf(machine: MachineState, name: string, where: string): AccountState {
  const account = machine.accounts.get(name.toLowerCase());
  if (!account) {
    throw new GenerateError(
      `there is no account called "${name}" on ${machine.id}. Add it to the machine's accounts, or create it with a create-account action first. It has: ${[
        ...machine.accounts.values(),
      ]
        .map((a) => a.name)
        .join(", ")}.`,
      where,
    );
  }
  return account;
}

/** The logon id the security log uses for this account's current session. */
export function logonIdOf(machine: MachineState, account: AccountState): string {
  account.logonId ??= `0x${(machine.nextLogonId += 0x1d3).toString(16)}`;
  return account.logonId;
}

// ---------------------------------------------------------------------------------------------
// Files

/** The live (not deleted) record at `path`, if there is one. Windows paths ignore case. */
export function liveRecord(disk: DiskState, path: string): FileEntry | undefined {
  const key = path.toLowerCase();
  return disk.records.find((r) => !r.deleted && r.path.toLowerCase() === key);
}

/** The record at `path` whether or not it is deleted, most recent first. */
export function recordsAt(disk: DiskState, path: string): FileEntry[] {
  const key = path.toLowerCase();
  return disk.records.filter((r) => r.path.toLowerCase() === key).reverse();
}

export interface EnsureOptions {
  readonly at: Instant;
  readonly owner: string;
  readonly kind?: "file" | "dir";
  readonly content?: string | Uint8Array;
}

/** Creates the record at `path` and every folder above it, or returns the one already there. */
export function ensurePath(disk: DiskState, path: string, options: EnsureOptions): FileEntry {
  const existing = liveRecord(disk, path);
  if (existing) return existing;
  const parent = parentPath(path);
  if (parent !== undefined) {
    ensurePath(disk, parent, { at: options.at, owner: options.owner, kind: "dir" });
  }
  return createRecord(disk, path, options);
}

/** A new record, even if something is already at that path (a deleted file, say). */
export function createRecord(disk: DiskState, path: string, options: EnsureOptions): FileEntry {
  const kind = options.kind ?? "file";
  const content = kind === "dir" ? new Uint8Array(0) : toBytes(options.content ?? "");
  const entry: FileEntry = {
    record: disk.nextRecord++,
    path,
    content,
    times: { m: options.at, a: options.at, c: options.at, b: options.at },
    deleted: false,
    clusters: kind === "dir" ? [] : allocate(disk, clustersFor(disk, content.length)),
    owner: options.owner,
    kind,
  };
  disk.records.push(entry);
  return entry;
}

/** Replaces a file's content, taking more clusters if it grew. */
export function writeContent(
  disk: DiskState,
  entry: FileEntry,
  content: string | Uint8Array,
  at: Instant,
): void {
  entry.content = toBytes(content);
  const wanted = clustersFor(disk, entry.content.length);
  while (entry.clusters.length < wanted) entry.clusters.push(disk.nextCluster++);
  if (entry.clusters.length > wanted) entry.clusters.length = wanted;
  entry.times.m = at;
  entry.times.a = at;
  entry.times.c = at;
}

/**
 * Deletes a record: the record and its clusters stay where they are, so the file is recoverable
 * until something reuses them, and a copy of its content lands in unallocated space, where a
 * carver can still find it. Returns where in unallocated space that copy starts.
 */
export function deleteRecord(disk: DiskState, entry: FileEntry, at: Instant): number {
  entry.deleted = true;
  entry.times.c = at;
  entry.unallocatedChunk = disk.unallocated.length;
  entry.unallocatedOffset = appendUnallocated(disk, entry.content);
  return entry.unallocatedOffset;
}

/** Puts bytes in unallocated space and returns the offset they start at. */
export function appendUnallocated(disk: DiskState, bytes: Uint8Array): number {
  const offset = disk.unallocatedLength;
  disk.unallocated.push(bytes);
  disk.unallocatedLength += bytes.length;
  return offset;
}

export function allocate(disk: DiskState, count: number): number[] {
  return Array.from({ length: count }, () => disk.nextCluster++);
}

function clustersFor(disk: DiskState, bytes: number): number {
  return Math.max(1, Math.ceil(bytes / disk.clusterSize));
}

export function toBytes(content: string | Uint8Array): Uint8Array {
  return typeof content === "string" ? utf8Bytes(content) : content;
}

/** Sets MACB times the way one kind of touch would. Anything left out stays as it was. */
export function touch(entry: FileEntry, times: Partial<MacbTimes>): void {
  entry.times = { ...entry.times, ...times };
}

/** The account a path belongs to on this machine, or SYSTEM outside anyone's home folder. */
export function ownerFor(machine: MachineState, path: string): string {
  const lower = path.toLowerCase();
  for (const account of machine.accounts.values()) {
    const home = account.home.toLowerCase();
    if (lower === home || lower.startsWith(`${home}\\`)) return account.name;
  }
  return "SYSTEM";
}

/** "C:\\Users\\dana\\Documents\\inv.pdf" → "inv.pdf". */
export { baseName };

// ---------------------------------------------------------------------------------------------
// Processes

/** The process a story names, by pid or by name (the one started most recently wins). */
export function findProcess(machine: MachineState, nameOrPid: string): ProcessEntry | undefined {
  if (/^[0-9]+$/.test(nameOrPid)) {
    const pid = Number(nameOrPid);
    return machine.processes.find((p) => p.pid === pid);
  }
  const key = nameOrPid.toLowerCase();
  return [...machine.processes].reverse().find((p) => p.name.toLowerCase() === key);
}

export interface StartProcessOptions {
  readonly name: string;
  readonly path?: string;
  readonly cmdline?: string;
  readonly user?: string;
  readonly parent?: string;
  readonly pid?: number;
  readonly threads?: number;
  readonly unlinked?: boolean;
  readonly at: Instant;
  readonly origin: number;
}

export function startProcess(machine: MachineState, options: StartProcessOptions): ProcessEntry {
  const pid = options.pid ?? machine.nextPid;
  if (machine.processes.some((p) => p.pid === pid)) {
    throw new GenerateError(`pid ${pid} is already a process on ${machine.id}.`);
  }
  machine.nextPid = Math.max(machine.nextPid, pid) + 4;
  const parent = options.parent === undefined ? undefined : findProcess(machine, options.parent);
  const path = options.path ?? `${machine.baseline.programFolder}\\${options.name}`;
  const entry: ProcessEntry = {
    pid,
    ppid: parent?.pid ?? 0,
    name: options.name,
    path,
    cmdline: options.cmdline ?? path,
    createdAt: options.at,
    user: options.user ?? primaryAccount(machine),
    threads: options.threads ?? 4,
    ...(options.unlinked ? { unlinked: true } : {}),
    origin: options.origin,
  };
  machine.processes.push(entry);
  machine.lastPid = pid;
  return entry;
}

/** The process an action means when it doesn't name one: the one started most recently. */
export function currentProcess(machine: MachineState): ProcessEntry | undefined {
  if (machine.lastPid > 0) return machine.processes.find((p) => p.pid === machine.lastPid);
  return [...machine.processes].reverse().find((p) => p.name === machine.baseline.shell);
}

export function nextRegionBase(machine: MachineState): number {
  const base = machine.nextRegionBase;
  machine.nextRegionBase += 0x10000;
  return base;
}
