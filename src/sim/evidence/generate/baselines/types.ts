import type { MachineKind } from "../types";

/**
 * A baseline is a **clean machine template**: what is on a machine before the story touches it
 * (docs/plan/03-case-format-and-generator.md §Generator). Baselines are kept small on purpose —
 * tens of files, not thousands — so a case's evidence stays well under a few hundred KB of JSON
 * and a beginner can read a whole folder listing without getting lost.
 *
 * Everything here is data. Nothing in a baseline reads the clock or draws a random number: the
 * generator ages the files and makes up the serial numbers from the case's seed.
 */

/** A file or folder every machine of this kind starts with. */
export interface BaselineFile {
  /** A Windows path on an imaged machine, such as "C:\\Users". */
  readonly path: string;
  readonly kind?: "file" | "dir";
  readonly content?: string;
  readonly owner?: string;
  /**
   * How long before the story started this was written, in days. Bigger is older. The generator
   * turns it into MACB times, with a few seeded minutes of jitter so they don't all match.
   */
  readonly agedDays?: number;
}

/** A file or folder created inside every account's home folder. `~` is the home folder itself. */
export interface BaselineHomeFile extends Omit<BaselineFile, "path" | "owner"> {
  /** Relative to the account's home folder: "Documents", "Documents\\notes.txt". */
  readonly path: string;
}

/** A process the machine is already running when the story starts. */
export interface BaselineProcess {
  readonly name: string;
  readonly path?: string;
  readonly cmdline?: string;
  readonly user?: string;
  /** The parent's name. Left out: the process has no parent in the capture (its parent exited). */
  readonly parent?: string;
  readonly threads?: number;
  /** How long before the story started it was running, in minutes. */
  readonly startedMinutesBefore?: number;
}

export interface Baseline {
  readonly id: string;
  readonly kind: MachineKind;
  /** One line for an author choosing a baseline. */
  readonly summary: string;
  /**
   * False for a machine that is never evidence, such as the analyst's own workstation: it has no
   * disk image, and listing it in a case's `evidence.disks` is refused.
   */
  readonly imaged: boolean;
  readonly device: { readonly model: string; readonly serialPrefix: string };
  readonly sectors: number;
  readonly clusterSize: number;
  readonly partitions: readonly { readonly label: string; readonly startSector: number }[];
  /** Accounts the machine always has. A case's `accounts` are added to these. */
  readonly accounts: readonly {
    readonly name: string;
    readonly groups?: readonly string[];
    /** Left out: "C:\\Users\\<name>". */
    readonly home?: string;
  }[];
  /** The group an account joins when nothing says otherwise. */
  readonly adminGroup: string;
  /** What starts a process a person ran: the shell, in `run-process`'s `parent`. */
  readonly shell: string;
  /** Where a newly made program is written when an action doesn't say. */
  readonly programFolder: string;
  readonly files: readonly BaselineFile[];
  readonly homeFiles: readonly BaselineHomeFile[];
  readonly processes: readonly BaselineProcess[];
  /** The first three octets of the machine's network, and the host number to start counting at. */
  readonly network: { readonly subnet: string; readonly firstHost: number };
}
