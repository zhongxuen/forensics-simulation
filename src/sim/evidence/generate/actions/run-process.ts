import type { ActionOf } from "../types";
import { ensurePath, ownerFor, startProcess, type ActionContext } from "../world";
import { domainOf, programBytes, subjectOf } from "./shared";

/**
 * A program starts. Two sources record it from different angles: the security log says a process
 * was created and who by, and the sysmon-lite monitor adds the command line and the parent. Put
 * them beside each other and you have the "what ran, started by what" chain a case is built on.
 *
 * The program's own file is created if the story has not already put it there, so a running
 * process on the machine always has a file on the disk to go and look at.
 *
 * Leaves: the process, its file, security 4688 and sysmon-lite 1.
 */
export function applyRunProcess(ctx: ActionContext, action: ActionOf<"run-process">): void {
  const path = action.path ?? `${ctx.machine.baseline.programFolder}\\${action.name}`;
  const user =
    action.user ?? subjectOf(ctx, ctx.machine.baseline.shell === "bash" ? "root" : "SYSTEM");
  const process = startProcess(ctx.machine, {
    name: action.name,
    path,
    ...(action.cmdline === undefined ? {} : { cmdline: action.cmdline }),
    user,
    parent: action.parent ?? ctx.machine.baseline.shell,
    ...(action.pid === undefined ? {} : { pid: action.pid }),
    ...(action.threads === undefined ? {} : { threads: action.threads }),
    ...(action.unlinked === undefined ? {} : { unlinked: action.unlinked }),
    at: ctx.recorded,
    origin: ctx.index,
  });

  if (ctx.machine.disk && path.includes("\\")) {
    const file = ensurePath(ctx.machine.disk, path, {
      at: ctx.recorded,
      owner: ownerFor(ctx.machine, path),
      kind: "file",
      content: programBytes(action.name),
    });
    ctx.note({
      kind: "file",
      image: ctx.machine.disk.id,
      record: file.record,
      at: file.times.b,
      what: `the program ${path}`,
    });
  }

  const parent = ctx.machine.processes.find((candidate) => candidate.pid === process.ppid);
  ctx.log(
    "security",
    {
      SubjectUserName: user,
      SubjectDomainName: domainOf(ctx.machine),
      NewProcessId: `0x${process.pid.toString(16)}`,
      NewProcessName: process.path,
      ParentProcessName: parent?.path ?? "-",
      CommandLine: process.cmdline,
      TokenElevationType: "%%1936",
    },
    { eventId: 4688, what: `${action.name} started` },
  );
  ctx.log(
    "sysmon-lite",
    {
      ProcessId: String(process.pid),
      Image: process.path,
      CommandLine: process.cmdline,
      User: user,
      ParentProcessId: String(process.ppid),
      ParentImage: parent?.path ?? "-",
    },
    { eventId: 1, what: `${action.name} started` },
  );
}
