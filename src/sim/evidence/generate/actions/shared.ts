import type { LogonType } from "../types";
import {
  currentProcess,
  diskOf,
  liveRecord,
  type ActionContext,
  type DiskState,
  type FileEntry,
  type MachineState,
  type ProcessEntry,
} from "../world";

/**
 * The few things most actions need: how Windows numbers a logon type, what a local account's
 * domain is called, which process wrote a file, and how to make up a SID that is the same every
 * time. One action per file, and anything two actions share lives here.
 */

/** Windows logon type numbers, as the security log records them. */
export const LOGON_TYPE_NUMBERS: Readonly<Record<LogonType, string>> = {
  interactive: "2",
  network: "3",
  service: "5",
  unlock: "7",
  remote: "10",
};

/** How an account signed in, from the number the log recorded. */
export function logonProcessFor(type: LogonType): string {
  if (type === "network") return "NtLmSsp";
  if (type === "service") return "Advapi";
  return "User32";
}

/** A workgroup machine is its own domain, so local accounts are recorded under its name. */
export function domainOf(machine: MachineState): string {
  return machine.id.toUpperCase();
}

/** The account doing the action, for a record's Subject fields. "-" when nobody is named. */
export function subjectOf(ctx: ActionContext, fallback = "-"): string {
  const { actor } = ctx.action;
  switch (actor.kind) {
    case "user":
      return actor.account;
    case "system":
      return "SYSTEM";
    case "analyst":
      return "examiner";
    case "attacker":
      return fallback;
  }
}

/** A made-up client port, high enough to look like one an operating system would pick. */
export function ephemeralPort(ctx: ActionContext): string {
  return String(ctx.rng.int(49_152, 65_535));
}

/**
 * The machine's SID, made up from its name so it is the same in every record. Real SIDs look like
 * `S-1-5-21-a-b-c-rid`; a machine account's rid starts at 1001.
 */
export function machineSid(machine: MachineState, rid = 1001): string {
  let hash = 0x811c9dc5;
  const part = (): number => {
    for (const char of machine.id) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  };
  return `S-1-5-21-${part()}-${part()}-${part()}-${rid}`;
}

/** The rid an account gets: its position in the machine's account list, from 1001. */
export function accountSid(machine: MachineState, name: string): string {
  const index = [...machine.accounts.keys()].indexOf(name.toLowerCase());
  return machineSid(machine, 1001 + Math.max(0, index));
}

/**
 * The process that wrote a file, for a file-created or file-deleted record: whatever the story
 * started last, or the machine's shell. A machine with no processes at all reports the kernel.
 */
export function writingProcess(ctx: ActionContext): Pick<ProcessEntry, "pid" | "name" | "path"> {
  return (
    currentProcess(ctx.machine) ?? {
      pid: 4,
      name: "System",
      path: "C:\\Windows\\System32\\ntoskrnl.exe",
    }
  );
}

/** The live record at `path`, or a complaint that names the machine and the path. */
export function requireFile(
  ctx: ActionContext,
  path: string,
): { disk: DiskState; file: FileEntry } {
  const disk = diskOf(ctx.machine, ctx.where);
  const file = liveRecord(disk, path);
  if (!file) {
    ctx.fail(
      `there is no file at ${path} on ${ctx.machine.id}. Create it earlier in the story, or check the path.`,
    );
  }
  return { disk, file };
}

/** The account whose home folder a path is in, for actions that need one. */
export function accountForPath(machine: MachineState, path: string): string | undefined {
  const lower = path.toLowerCase();
  for (const account of machine.accounts.values()) {
    const home = account.home.toLowerCase();
    if (lower === home || lower.startsWith(`${home}\\`)) return account.name;
  }
  return undefined;
}

/** Turns a whole number of seconds into milliseconds, for the beacon interval. */
export function seconds(value: number): number {
  return value * 1000;
}

/** A short, made-up run of bytes that looks like the start of a program a tool would see. */
export function programBytes(name: string): string {
  return `MZ\u0000\u0000This program cannot be run in DOS mode.\u0000${name}\u0000`;
}
