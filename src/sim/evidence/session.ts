/**
 * How evidence reaches the terminal (docs/plan/04-disk-tools.md §How evidence reaches the
 * terminal).
 *
 * A case hands the player an `EvidenceSet`. On the analyst workstation it shows up as **devices**
 * under `/dev/evidence/`, not as files: `/dev/evidence/qf-lt-07` is the original drive, and it is
 * the thing you never examine directly. `acquire` makes a working copy somewhere in the player's
 * own folders, and every other disk tool reads that copy.
 *
 * Each device has a **write-blocker**, a flag the `blocker` command turns on and off. With it on,
 * reading the original goes through `mountRead` and changes nothing. With it off, reading goes
 * through `mountWrite`: every live record's access time becomes the time of the read, the image's
 * hash changes with it, and the change lasts for the rest of the run. That is Case 1's wrong turn
 * (docs/plan/00-overview.md §4 row 15), and the vendored Reset machine button undoes it.
 *
 * This module is the state extension and its read and write helpers. It is pure like the rest of
 * `src/sim`: nothing here reads a clock, and every "change" returns a new state.
 *
 * The session is deliberately *not* part of a serialized snapshot (`core/validate.ts` keeps only
 * the fields it knows). Saved case runs are replays of a command log, not engine snapshots
 * (docs/plan/00-overview.md §4 row 9), so evidence is re-attached when the scenario is built.
 */
import { mountRead, mountWrite, type DiskView } from "./disk";
import type { ArtefactRef, DiskImage, EvidenceSet, Instant } from "./types";
import { actorFor } from "../fs/accounts";
import { mkdir, writeFile, type FsContext } from "../fs/ops";
import { normalizePath } from "../fs/path";
import { sessionMachine, withSessionFs } from "../core/session";
import type { OutputLine, SimEvent, SimState } from "../core/types";

/** The folder every evidence device appears in. Nothing the player writes may land inside it. */
export const EVIDENCE_ROOT = "/dev/evidence";

/** One piece of evidence, as it is attached to this workstation. */
export interface AttachedItem {
  /** The image's id, which is also the device's name: "qf-lt-07". */
  readonly id: string;
  /** Where it appears on the workstation: "/dev/evidence/qf-lt-07". */
  readonly path: string;
  /** True while the write-blocker is on, which is how evidence arrives. */
  readonly blocker: boolean;
  /** When the original was last read with the blocker off, if it ever was. */
  readonly changedAt?: Instant;
}

/** One line a forensics tool printed, kept so `pin` can point back at it. */
export interface RecalledLine {
  readonly text: string;
  readonly ref?: ArtefactRef;
}

/** The evidence a workstation has attached to it: `SimState.evidence`. */
export interface EvidenceSession {
  /** The case's evidence, as it was handed over. Never changes. */
  readonly set: EvidenceSet;
  /** Every attached device, by image id. */
  readonly attached: Readonly<Record<string, AttachedItem>>;
  /**
   * Every set of image bytes the player can point a tool at, by workstation path: each device's
   * original (which `mountWrite` replaces when the blocker is off) and each working copy
   * `acquire` has written.
   */
  readonly images: Readonly<Record<string, DiskImage>>;
  /** What the last forensics tool printed, for `pin`. */
  readonly lastOutput: readonly RecalledLine[];
  /** The command that printed it, for `pin`'s confirmation line. */
  readonly lastCommand: string;
}

/** What `cat` and the evidence browser show for a device: an explanation, never bytes. */
export function devicePlacard(image: DiskImage, devicePath: string): string {
  return [
    "This is evidence, not a file.",
    "",
    `${devicePath} is the original drive from ${image.id}`,
    `(${image.device.model}, serial ${image.device.serial}), attached through a`,
    "write-blocker. Reading it here would show you raw bytes and would touch",
    "the original, which is the one thing an examiner never does.",
    "",
    "Make a working copy first, then examine the copy:",
    "",
    `  acquire ${devicePath} --out ~/cases/images/${image.id}.img`,
    "",
    "See the write-blockers with: blocker",
    "",
  ].join("\n");
}

export interface AttachOptions {
  /** The mtime the device entries get. Defaults to 0, which is fine for a fixture. */
  readonly now?: Instant;
  /** Write-blockers start on, the way evidence is meant to arrive. */
  readonly blocker?: boolean;
}

/**
 * Attaches an evidence set to the session's workstation: a device under `/dev/evidence` per disk
 * image, each with its write-blocker on, plus the session state the forensics tools read.
 *
 * Throws a RangeError when a device entry can't be written, which is an authoring bug (the
 * scenario's filesystem has something else at that path), never something a player can cause.
 */
export function attachEvidence(
  state: SimState,
  set: EvidenceSet,
  options: AttachOptions = {},
): SimState {
  const now = options.now ?? 0;
  const blocker = options.blocker ?? true;
  const attached: Record<string, AttachedItem> = {};
  const images: Record<string, DiskImage> = {};

  // The devices are laid down as root, and the player's account only ever reads them: the one
  // thing the workstation must not let them do is write to evidence.
  const machine = sessionMachine(state);
  const root = actorFor(machine.accounts, "root");
  if (!root) throw new RangeError("attachEvidence: this machine has no root account.");
  const ctx: FsContext = { actor: root, cwd: "/", now };

  const made = mkdir(machine.fs, ctx, EVIDENCE_ROOT, { parents: true });
  if (!made.ok) {
    throw new RangeError(`attachEvidence: could not make ${EVIDENCE_ROOT} (${made.error.code}).`);
  }
  let fs = made.value;

  for (const image of set.disks) {
    const path = `${EVIDENCE_ROOT}/${image.id}`;
    attached[image.id] = { id: image.id, path, blocker };
    images[path] = image;
    const written = writeFile(fs, ctx, path, devicePlacard(image, path));
    if (!written.ok) {
      throw new RangeError(
        `attachEvidence: could not put ${image.id} at ${path} (${written.error.code}).`,
      );
    }
    fs = written.value;
  }
  const next = withSessionFs(state, fs);

  return {
    ...next,
    evidence: { set, attached, images, lastOutput: [], lastCommand: "" },
  };
}

/** The workstation's evidence, or undefined when none is attached. */
export function evidenceSession(state: SimState): EvidenceSession | undefined {
  return state.evidence;
}

/** True for anything inside the evidence device folder, including the folder itself. */
export function isEvidencePath(path: string): boolean {
  const full = normalizePath(path.startsWith("/") ? path : `/${path}`);
  return full === EVIDENCE_ROOT || full.startsWith(`${EVIDENCE_ROOT}/`);
}

/** The device at a canonical workstation path, if one is there. */
export function deviceAt(session: EvidenceSession, path: string): AttachedItem | undefined {
  return Object.values(session.attached).find((item) => item.path === path);
}

/** The image bytes a tool would read at a canonical workstation path. */
export function imageAt(session: EvidenceSession, path: string): DiskImage | undefined {
  return Object.hasOwn(session.images, path) ? session.images[path] : undefined;
}

/**
 * Every place an image with this id can be read from, working copies first. A bare id on the
 * command line means "the copy I made", and falls back to the original when no copy exists yet.
 */
export function pathsForImage(session: EvidenceSession, id: string): readonly string[] {
  const paths = Object.keys(session.images)
    .filter((path) => session.images[path]?.id === id)
    .sort();
  return [...paths.filter((path) => !isEvidencePath(path)), ...paths.filter(isEvidencePath)];
}

/** A copy of the state with one device's write-blocker turned on or off. */
export function setBlocker(state: SimState, id: string, on: boolean): SimState {
  const session = state.evidence;
  const item = session && Object.hasOwn(session.attached, id) ? session.attached[id] : undefined;
  if (!session || !item) return state;
  return {
    ...state,
    evidence: {
      ...session,
      attached: { ...session.attached, [id]: { ...item, blocker: on } },
    },
  };
}

/** What reading an original device cost: the view to read, the state after it, and the event. */
export interface OriginalRead {
  readonly state: SimState;
  readonly view: DiskView;
  /** True when the read went through the write-blocker and changed nothing. */
  readonly blocker: boolean;
  readonly event: SimEvent;
}

/**
 * Reads an original evidence device, the way the write-blocker's setting says it must be read.
 *
 * With the blocker on this is `mountRead` and nothing changes. With it off it is `mountWrite`:
 * the operating system opens every live record as it mounts, each one's access time becomes `at`,
 * and the image's hash changes with it. The changed image replaces the original in the session,
 * so every later read sees it too, until the machine is reset.
 */
export function readOriginal(
  state: SimState,
  item: AttachedItem,
  tool: string,
  at: Instant,
): OriginalRead {
  const session = state.evidence;
  const image = session ? imageAt(session, item.path) : undefined;
  if (!session || !image) {
    throw new RangeError(`readOriginal: ${item.path} has no image attached.`);
  }
  const event: SimEvent = {
    type: "evidence.readOriginal",
    device: item.path,
    blocker: item.blocker,
    tool,
  };
  if (item.blocker) return { state, view: mountRead(image), blocker: true, event };

  const changed = mountWrite(image, at);
  const next: SimState = {
    ...state,
    evidence: {
      ...session,
      attached: { ...session.attached, [item.id]: { ...item, changedAt: at } },
      images: { ...session.images, [item.path]: changed },
    },
  };
  return { state: next, view: mountRead(changed), blocker: false, event };
}

/** A copy of the state that knows about a working copy `acquire` has just written. */
export function withAcquiredImage(state: SimState, path: string, image: DiskImage): SimState {
  const session = state.evidence;
  if (!session) return state;
  return { ...state, evidence: { ...session, images: { ...session.images, [path]: image } } };
}

/**
 * Remembers what a tool printed, so `pin` can point at one of its lines. Only the forensics tools
 * call this: `pin` itself leaves the memory alone, so pinning twice pins from the same output.
 */
export function rememberOutput(
  state: SimState,
  command: string,
  output: readonly OutputLine[],
): SimState {
  const session = state.evidence;
  if (!session) return state;
  const lastOutput = output.map((line) => ({
    text: line.text,
    ...(line.ref === undefined ? {} : { ref: line.ref }),
  }));
  return { ...state, evidence: { ...session, lastOutput, lastCommand: command } };
}
