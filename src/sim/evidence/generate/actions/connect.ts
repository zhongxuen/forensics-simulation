import type { ActionOf } from "../types";
import { currentProcess, findProcess, type ActionContext } from "../world";
import { ephemeralPort } from "./shared";

/**
 * A program opens a connection. With `every` and `times` it opens the same one again and again —
 * a beacon, checking in with whoever is on the other end. Regular, identical, small connections
 * are the shape to look for; the first one to notice them is usually a timeline, not a person.
 *
 * Leaves: one connection in memory and one sysmon-lite 3 record per check-in. Every connection but
 * the last is recorded as closing, because that is what a capture would find.
 */
export function applyConnect(ctx: ActionContext, action: ActionOf<"connect">): void {
  const process =
    action.process === undefined
      ? currentProcess(ctx.machine)
      : findProcess(ctx.machine, action.process);
  if (!process) {
    ctx.fail(
      action.process === undefined
        ? `nothing is running on ${ctx.machine.id} to open a connection. Start a process first, or name one with process:.`
        : `there is no process called "${action.process}" on ${ctx.machine.id}.`,
    );
  }

  const times = action.times ?? 1;
  const gap = (action.every ?? 0) * 1000;
  const [remoteAddress = action.remote, remotePort = "443"] = action.remote.split(":");

  for (let i = 0; i < times; i++) {
    const at = ctx.recorded + i * gap;
    const local = action.local ?? `${ctx.machine.ip}:${ephemeralPort(ctx)}`;
    const last = i === times - 1;
    ctx.machine.connections.push({
      pid: process.pid,
      proto: action.proto ?? "TCPv4",
      local,
      remote: action.remote,
      state: action.state ?? (last ? "ESTABLISHED" : "CLOSE_WAIT"),
      createdAt: at,
      origin: ctx.index,
    });
    ctx.log(
      "sysmon-lite",
      {
        ProcessId: String(process.pid),
        Image: process.path,
        User: process.user,
        Protocol: (action.proto ?? "TCPv4").startsWith("UDP") ? "udp" : "tcp",
        SourceIp: local.split(":")[0] ?? ctx.machine.ip,
        SourcePort: local.split(":")[1] ?? "0",
        DestinationIp: remoteAddress,
        DestinationPort: remotePort,
      },
      { eventId: 3, at, what: `${process.name} connected to ${action.remote}` },
    );
  }
}
