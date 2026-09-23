import type { ArtefactRef, EvidenceSet, Instant, LogSource, ZonedSource } from "../types";

/**
 * What the generator is given and what it hands back (docs/plan/03-case-format-and-generator.md).
 *
 * A case YAML describes the **ground-truth story**: who did what, on which machine, at which
 * instant. `generate` plays that story against a clean machine and writes down every artefact it
 * would really leave. Nobody writes evidence by hand.
 *
 * These are the generator's *input* types. The authoring schema lives in
 * `src/content/cases/schema.ts`, which src/sim may not import (the content boundary), so its
 * output is checked against `CaseSpec` by a type assertion in tests/content/case-schema.test.ts.
 */

// ---------------------------------------------------------------------------------------------
// Machines

/** What kind of machine this is, in the story. The baseline says what is on it. */
export const MACHINE_KINDS = ["windows-laptop", "windows-server", "linux-workstation"] as const;
export type MachineKind = (typeof MACHINE_KINDS)[number];

export interface MachineSpec {
  /** The host name, which is also its disk image's id: "qf-lt-07". */
  readonly id: string;
  readonly kind: MachineKind;
  /** A template from src/sim/evidence/generate/baselines. */
  readonly baseline: string;
  /** The machine's own time zone, an IANA name in the offset table (src/sim/evidence/time.ts). */
  readonly zone: string;
  /** Its address. Left out: taken from the baseline's subnet, in the order machines are listed. */
  readonly ip?: string;
  /** Accounts on the machine, beyond the baseline's. Each gets a home folder. */
  readonly accounts?: readonly string[];
  readonly device?: { readonly model?: string; readonly serial?: string };
}

// ---------------------------------------------------------------------------------------------
// Story actions

/** Who is doing this. `user` names the account; the others are roles. */
export type Actor =
  | { readonly kind: "user"; readonly account: string }
  | { readonly kind: "attacker" }
  | { readonly kind: "system" }
  | { readonly kind: "analyst" };

/** How an account signed in. Each maps to the logon type number the security log records. */
export const LOGON_TYPES = ["interactive", "network", "service", "unlock", "remote"] as const;
export type LogonType = (typeof LOGON_TYPES)[number];

/** Fields every action has. */
export interface ActionBase {
  /** Optional, for a report question's `answerFrom` and for readable test failures. */
  readonly id?: string;
  /** The true instant it happens, UTC. A machine with a skewed clock writes a different one. */
  readonly at: Instant;
  readonly actor: Actor;
  /** The machine it happens on. */
  readonly on: string;
  /** A note to the author. Never shown to a player. */
  readonly note?: string;
}

type Action<K extends string, F> = ActionBase & { readonly do: K } & F;

interface FirewallFields {
  readonly dst: string;
  readonly dpt: string;
  readonly src?: string;
  readonly spt?: string;
  readonly proto?: string;
  readonly bytes?: string;
  readonly rule?: string;
}

export type StoryAction =
  | Action<
      "logon",
      {
        readonly account: string;
        readonly type: LogonType;
        /** The address it came from, for a remote or network logon. */
        readonly from?: string;
        readonly workstation?: string;
        /** Also record "special privileges assigned to new logon" (event 4672). */
        readonly elevated?: boolean;
      }
    >
  | Action<"logoff", { readonly account: string }>
  | Action<
      "failed-logon",
      {
        readonly account: string;
        readonly type: LogonType;
        readonly from?: string;
        /** Why it was refused, in the log's words. Defaults to a wrong password. */
        readonly reason?: string;
      }
    >
  | Action<"create-account", { readonly account: string; readonly by?: string }>
  | Action<
      "add-to-group",
      { readonly account: string; readonly group: string; readonly by?: string }
    >
  | Action<
      "create-file",
      { readonly path: string; readonly content?: string; readonly owner?: string }
    >
  | Action<
      "modify-file",
      { readonly path: string; readonly content?: string; readonly append?: string }
    >
  | Action<"read-file", { readonly path: string }>
  | Action<"delete-file", { readonly path: string }>
  | Action<
      "overwrite-clusters",
      {
        /** The deleted file whose clusters get reused. */
        readonly path: string;
        /** The file that takes them over. Defaults to a temporary file. */
        readonly by?: string;
        readonly content?: string;
      }
    >
  | Action<
      "usb-insert",
      {
        readonly device: string;
        /** The drive letter it appears as. Defaults to E. */
        readonly letter?: string;
        readonly model?: string;
        readonly serial?: string;
      }
    >
  | Action<
      "copy-to-usb",
      {
        readonly path: string;
        readonly device?: string;
        /** The path on the removable drive. Defaults to its root plus the file's name. */
        readonly to?: string;
      }
    >
  | Action<"browse", { readonly url: string; readonly account?: string }>
  | Action<"download", { readonly url: string; readonly path: string; readonly content?: string }>
  | Action<
      "run-process",
      {
        readonly name: string;
        readonly path?: string;
        /** The parent process's name. Defaults to the machine's shell. */
        readonly parent?: string;
        readonly cmdline?: string;
        readonly user?: string;
        readonly pid?: number;
        readonly threads?: number;
        /** Unlinked from the active process list: a list walk misses it, a pool scan finds it. */
        readonly unlinked?: boolean;
      }
    >
  | Action<
      "inject",
      {
        /** The process it writes into: a name or a pid. */
        readonly into: string;
        readonly protection?: "PAGE_EXECUTE_READWRITE" | "PAGE_EXECUTE_READ" | "PAGE_READWRITE";
        readonly preview?: string;
        readonly size?: number;
      }
    >
  | Action<
      "connect",
      {
        readonly remote: string;
        readonly proto?: "TCPv4" | "UDPv4";
        readonly local?: string;
        /** The process that opens it: a name or a pid. Defaults to the one started last. */
        readonly process?: string;
        readonly state?: "ESTABLISHED" | "LISTENING" | "CLOSE_WAIT" | "SYN_SENT";
        /** Seconds between beacons. With `times`, the connection repeats. */
        readonly every?: number;
        readonly times?: number;
      }
    >
  | Action<"firewall-allow", FirewallFields>
  | Action<"firewall-block", FirewallFields>
  | Action<
      "dns-query",
      {
        readonly query: string;
        readonly type?: string;
        readonly answer?: string;
        readonly client?: string;
      }
    >
  | Action<
      "web-request",
      {
        readonly path: string;
        readonly method?: string;
        readonly status?: string;
        readonly clientIp?: string;
        readonly userAgent?: string;
        readonly bytes?: string;
        readonly referer?: string;
        readonly user?: string;
      }
    >
  | Action<
      "clock-skew",
      {
        /** How far ahead the machine's clock now runs, in minutes. Negative: behind. */
        readonly minutes: number;
      }
    >
  | Action<"capture-memory", { readonly id?: string }>
  | Action<
      "hand-over",
      {
        /** What was handed over. Defaults to the machine in `on`. */
        readonly item?: string;
        readonly by: string;
        /** Put the item's MD5 and SHA-256 on the form. Defaults to true for a disk image. */
        readonly hashes?: boolean;
      }
    >;

/** Every `do:` value a story can use. */
export type StoryActionKind = StoryAction["do"];

/** One kind of action, picked out of the union by its `do:` value. */
export type ActionOf<K extends StoryActionKind> = Extract<StoryAction, { do: K }>;

// ---------------------------------------------------------------------------------------------
// Noise

export const NOISE_PROFILE_IDS = ["office-day", "quiet-night", "server-idle"] as const;
export type NoiseProfileId = (typeof NOISE_PROFILE_IDS)[number];

export const NOISE_DENSITIES = ["none", "low", "medium", "high"] as const;
export type NoiseDensity = (typeof NOISE_DENSITIES)[number];

export interface NoiseSpec {
  readonly profile: NoiseProfileId;
  readonly density: NoiseDensity;
}

// ---------------------------------------------------------------------------------------------
// The case, as the generator needs it

export interface EvidenceSelection {
  /** Machine (or removable device) ids whose disk images are handed over. */
  readonly disks: readonly string[];
  /** The log sources handed over. Records from any other source are left out. */
  readonly logs: readonly LogSource[];
  /** Machine ids whose memory captures are handed over. */
  readonly memory: readonly string[];
  /** Which sources *display* local time, and in which zone. Absent means UTC. */
  readonly zones?: Readonly<Partial<Record<ZonedSource, string>>>;
}

export interface CaseSpec {
  readonly id: string;
  /** Drives the noise and every made-up detail. The same seed always gives the same evidence. */
  readonly seed: number;
  readonly machines: readonly MachineSpec[];
  readonly story: readonly StoryAction[];
  readonly noise?: NoiseSpec;
  readonly evidence: EvidenceSelection;
}

// ---------------------------------------------------------------------------------------------
// What the generator hands back

/** One artefact a story action left behind, and the time it was written down. */
export interface TracedArtefact {
  readonly ref: ArtefactRef;
  /**
   * The instant the artefact records. Usually the action's own instant; on a machine with a
   * skewed clock (`clock-skew`), it is the time that machine believes it is.
   */
  readonly at: Instant;
  /** What it is, in a few words: "security 4624", "the deleted file". */
  readonly what: string;
}

/** What one action did, so tests can check the evidence against the story that made it. */
export interface TraceEntry {
  /** Its position in the merged, time-sorted run. */
  readonly index: number;
  readonly id?: string;
  readonly do: StoryActionKind;
  readonly at: Instant;
  readonly on: string;
  /** "story" for the case's own actions, "noise" for the seeded benign activity around them. */
  readonly source: "story" | "noise";
  readonly artefacts: readonly TracedArtefact[];
}

export interface GenerateResult {
  readonly evidence: EvidenceSet;
  /** Every action in the order it was applied, story and noise, with what it left behind. */
  readonly trace: readonly TraceEntry[];
  /**
   * Sources a story wrote to that the case doesn't hand over, so their records were left out.
   * `pnpm evidence:build` prints these: they are usually a missing entry in `evidence.logs`.
   */
  readonly droppedSources: readonly LogSource[];
}

/** A story the generator can't play, with a message that names the action and what to fix. */
export class GenerateError extends Error {
  constructor(
    message: string,
    readonly where?: string,
  ) {
    super(where === undefined ? message : `${where}: ${message}`);
    this.name = "GenerateError";
  }
}

// ---------------------------------------------------------------------------------------------
// Pieces the world and the actions share

/** A log record before its sequence number is known: they are assigned in time order, at the end. */
export interface PendingLog {
  readonly key: number;
  readonly source: LogSource;
  readonly at: Instant;
  readonly host: string;
  readonly eventId?: number;
  readonly fields: Record<string, string>;
}

interface ArtefactNote {
  readonly at: Instant;
  readonly what: string;
}

/** An artefact named before the part of its ref that only exists at the end (a log sequence). */
export type PendingArtefact =
  | ({ readonly kind: "log"; readonly key: number } & ArtefactNote)
  | ({ readonly kind: "file"; readonly image: string; readonly record: number } & ArtefactNote)
  | ({ readonly kind: "carve"; readonly image: string; readonly offset: number } & ArtefactNote)
  | ({ readonly kind: "process"; readonly image: string; readonly pid: number } & ArtefactNote)
  | ({
      readonly kind: "connection";
      readonly image: string;
      readonly index: number;
    } & ArtefactNote)
  | ({ readonly kind: "region"; readonly image: string; readonly base: number } & ArtefactNote);
