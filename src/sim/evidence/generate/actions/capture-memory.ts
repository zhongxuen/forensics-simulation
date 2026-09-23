import { encodeBase64 } from "../../base64";
import type { MemoryImage, MemoryString } from "../../types";
import type { ActionOf } from "../types";
import { type ActionContext, type MachineState } from "../world";

/**
 * Everything the machine is holding in memory right now is written to a file. Memory is the most
 * perishable evidence there is — pull the plug and it is gone — which is why the order of
 * volatility says capture it before anything else (RFC 3227).
 *
 * The capture is a photograph: processes (including any unlinked from the active list), open
 * connections, loaded modules, stretches of memory, and the readable text found in them. A process
 * that has already exited is left out, exactly as it would be.
 */
export function applyCaptureMemory(ctx: ActionContext, action: ActionOf<"capture-memory">): void {
  const { machine } = ctx;
  const id = action.id ?? `${machine.id}-mem`;
  if (ctx.world.memory.some((image) => image.id === id)) {
    ctx.fail(`there is already a memory capture called "${id}". Give this one an id of its own.`);
  }

  const live = machine.processes.filter(
    (process) => process.exitedAt === undefined || process.exitedAt > ctx.recorded,
  );
  const pids = new Set(live.map((process) => process.pid));
  const connections = machine.connections.filter((connection) => pids.has(connection.pid));
  const regions = machine.regions.filter((region) => pids.has(region.pid));

  const image: MemoryImage = {
    id,
    capturedAt: ctx.recorded,
    host: machine.id,
    processes: live.map((process) => ({
      pid: process.pid,
      ppid: process.ppid,
      name: process.name,
      path: process.path,
      cmdline: process.cmdline,
      createdAt: process.createdAt,
      ...(process.exitedAt === undefined ? {} : { exitedAt: process.exitedAt }),
      user: process.user,
      threads: process.threads,
      ...(process.unlinked ? { unlinked: true } : {}),
    })),
    connections: connections.map((connection) => ({
      pid: connection.pid,
      proto: connection.proto,
      local: connection.local,
      remote: connection.remote,
      state: connection.state,
      createdAt: connection.createdAt,
    })),
    modules: machine.modules.filter((module) => pids.has(module.pid)),
    regions: regions.map((region) => ({
      pid: region.pid,
      base: region.base,
      size: region.size,
      protection: region.protection,
      ...(region.backedBy === undefined ? {} : { backedBy: region.backedBy }),
      previewB64: encodeBase64(region.preview),
    })),
    strings: stringsIn(machine, live, connections, regions),
  };
  ctx.world.memory.push(image);

  // Everything in the capture is credited to the action that put it there, so a test can check
  // each one against the story beat it came from. The capture itself leaves no ref of its own:
  // what it hands over is the things inside it.
  for (const process of live) {
    ctx.noteFor(process.origin, {
      kind: "process",
      image: id,
      pid: process.pid,
      at: process.createdAt,
      what: `the process ${process.name}`,
    });
  }
  connections.forEach((connection, index) => {
    ctx.noteFor(connection.origin, {
      kind: "connection",
      image: id,
      index,
      at: connection.createdAt,
      what: `the connection to ${connection.remote}`,
    });
  });
  for (const region of regions) {
    ctx.noteFor(region.origin, {
      kind: "region",
      image: id,
      base: region.base,
      at: ctx.recorded,
      what: `the memory written into ${machine.processes.find((p) => p.pid === region.pid)?.name ?? "a process"}`,
    });
  }
}

/**
 * The readable text a capture holds: what each program was started with, what was written into
 * memory, and the addresses of open connections. Offsets count up in even steps, because a real
 * strings run reports where in the file each one was found and the game needs that to be stable.
 */
function stringsIn(
  machine: MachineState,
  processes: readonly { pid: number; cmdline: string }[],
  connections: readonly { pid: number; remote: string }[],
  regions: readonly { pid: number; base: number; preview: Uint8Array }[],
): MemoryString[] {
  const found: MemoryString[] = [];
  let offset = 0x10000;
  const add = (value: string, pid: number) => {
    if (value.trim() === "") return;
    found.push({ offset, value, pid });
    offset += 0x100;
  };
  for (const process of processes) add(process.cmdline, process.pid);
  for (const region of regions) {
    for (const value of printableRuns(region.preview)) add(value, region.pid);
  }
  for (const connection of connections) add(connection.remote, connection.pid);
  void machine;
  return found;
}

/** Runs of four or more printable characters, the way a strings tool finds them. */
function printableRuns(bytes: Uint8Array): string[] {
  const runs: string[] = [];
  let current = "";
  for (const byte of bytes) {
    if (byte >= 0x20 && byte <= 0x7e) {
      current += String.fromCharCode(byte);
      continue;
    }
    if (current.length >= 4) runs.push(current);
    current = "";
  }
  if (current.length >= 4) runs.push(current);
  return runs;
}
