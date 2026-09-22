/**
 * The engine's core contract:
 *
 *   step(state: SimState, cmd: SimCommand, ctx: SimContext): SimResult
 *
 * No I/O, no globals, no ambient time or randomness. Given the same initial state, seed, and
 * commands, the output is byte-identical every run.
 */
import type { SimError } from "./errors";
import type { ArtefactRef } from "../evidence/types";
import type { Accounts, Vfs } from "../fs/types";
import type { DiscoveryState, NetworkGraph, NetworkSpec, Protocol } from "../net/types";
import type { ShellCommand } from "../shell/types";
import type { ToolRegistry } from "../tools/types";

/** Where the learner is: which machine, as which user, in which folder. */
export interface Session {
  readonly hostId: string;
  readonly user: string;
  /** Canonical absolute path. */
  readonly cwd: string;
  /** Shell variables. `PWD` and `OLDPWD` follow `cd`. */
  readonly env: Readonly<Record<string, string>>;
  /** Command lines run in this session, oldest first, for the `history` command. */
  readonly history: readonly string[];
}

/** A host the learner can have a shell on: its users and its filesystem. */
export interface Machine {
  readonly accounts: Accounts;
  readonly fs: Vfs;
}

/** A secret to find. Finding it means its token appears in a command's output. */
export interface FlagDef {
  readonly id: string;
  readonly token: string;
}

export interface SimState {
  readonly scenarioId: string;
  /** The run's seed. Each command's randomness is derived from this and `tick`. */
  readonly seed: number;
  /** How many commands have run. */
  readonly tick: number;
  readonly session: Session;
  /** Ground truth. Never changes during a run. */
  readonly network: NetworkGraph;
  /** Filesystems and accounts, by host id, for hosts that have them. */
  readonly machines: Readonly<Record<string, Machine>>;
  /** What the learner has observed. The only network data the visualizer may render. */
  readonly discovery: DiscoveryState;
  readonly flags: readonly FlagDef[];
  /** Ids of found flags, in the order they were found. */
  readonly flagsFound: readonly string[];
}

/**
 * One command line, already parsed into words by the terminal. The engine never parses or
 * evaluates shell syntax: it looks the first word up in the tool registry, and that's all.
 */
export interface ExecCommand {
  readonly type: "exec";
  /** The command name, then its arguments: ["netscan", "10.0.1.0/24"]. */
  readonly argv: readonly string[];
  /** Text piped in from a previous command, if any. */
  readonly stdin?: string;
}

/**
 * `exec` runs one tool with ready-made arguments (tests, replays). `shell` runs a whole command
 * line the terminal has parsed: pipelines, redirections, `&&`, variables and wildcards.
 */
export type SimCommand = ExecCommand | ShellCommand;

export interface OutputLine {
  readonly stream: "stdout" | "stderr";
  /** The realistic text, as a terminal would show it. */
  readonly text: string;
  /** Present on lines reporting an expected failure, for the beginner explainer layer. */
  readonly error?: SimError;
  /**
   * Forensics addition (docs/plan/02-evidence-model.md §Artefact refs): the piece of evidence this
   * line shows. Tools set it, `pin` reads it, the grader checks it.
   */
  readonly ref?: ArtefactRef;
}

/**
 * Something that happened, for missions (objective checks), the network map, and the mentor to
 * subscribe to. Events are the integration seam: nothing outside the engine should need to look
 * at engine internals. Fields are flat primitives so declarative checks can match on them.
 *
 * "*.discovered" events fire once, the first time the learner observes that thing.
 */
export type SimEvent =
  | {
      readonly type: "command.run";
      readonly command: string;
      readonly line: string;
      readonly exitCode: number;
    }
  | ({ readonly type: "command.error"; readonly command: string } & SimError)
  | { readonly type: "help.viewed"; readonly command: string }
  | {
      readonly type: "host.discovered";
      readonly hostId: string;
      readonly ip: string;
      readonly via: string;
    }
  | {
      readonly type: "service.discovered";
      readonly hostId: string;
      readonly ip: string;
      readonly port: number;
      readonly protocol: Protocol;
      readonly service: string;
      readonly via: string;
    }
  | {
      readonly type: "service.fingerprinted";
      readonly hostId: string;
      readonly port: number;
      readonly product: string;
      readonly version: string;
    }
  | {
      readonly type: "scan.completed";
      readonly target: string;
      readonly hostsUp: number;
      readonly openPorts: number;
      readonly portScan: boolean;
    }
  | {
      readonly type: "web.probed";
      readonly hostId: string;
      readonly port: number;
      readonly path: string;
      readonly status: number;
    }
  | { readonly type: "file.read"; readonly hostId: string; readonly path: string }
  | {
      readonly type: "file.changed";
      readonly hostId: string;
      /** Canonical path of what changed (the new path, for a move). */
      readonly path: string;
      readonly change: FileChange;
    }
  | {
      readonly type: "log.queried";
      readonly hostId: string;
      readonly path: string;
      readonly matched: number;
    }
  | { readonly type: "hash.identified"; readonly format: string }
  | { readonly type: "flag.found"; readonly flagId: string };

export type SimEventType = SimEvent["type"];

/** What happened to a file, for `file.changed` events. */
export type FileChange = "created" | "modified" | "deleted" | "moved" | "permissions" | "owner";

export interface SimResult {
  readonly state: SimState;
  readonly output: readonly OutputLine[];
  readonly events: readonly SimEvent[];
  /** 0 for success, like a shell's `$?`. The terminal needs it for `&&`. */
  readonly exitCode: number;
}

/** What the caller injects. `now` is read exactly once per step. */
export interface SimContext {
  readonly now: () => number;
  /** Defaults to the built-in tools (tools/index.ts). */
  readonly registry?: ToolRegistry;
}

/** Everything needed to build a starting SimState. Mission content writes these as data. */
export interface ScenarioSpec {
  readonly id: string;
  /** In-world time the scenario starts at (ISO-8601). Defaults to DEFAULT_START_TIME. */
  readonly startTime?: string;
  readonly network: NetworkSpec;
  /** Where the learner starts. The host must have a filesystem. */
  readonly session: {
    readonly host: string;
    readonly user: string;
    /** Defaults to the user's home folder. */
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string>>;
  };
  /** Hosts the learner already knows about from the briefing, shown on the map from the start. */
  readonly knownHosts?: readonly string[];
  readonly flags?: readonly FlagDef[];
}
