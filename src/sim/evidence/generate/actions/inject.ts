import type { ActionOf } from "../types";
import { findProcess, nextRegionBase, toBytes, type ActionContext } from "../world";

/**
 * Code is written into another program's memory and run there. Nothing new shows up in a list of
 * processes: the work happens inside one that belongs there, which is why memory is the only place
 * this is visible at all (MITRE ATT&CK calls the family T1055).
 *
 * What it leaves is a stretch of memory that is both writable and executable and is backed by no
 * file on disk. Ordinary code is loaded from a file and is not writable while it runs, so that
 * pairing is the tell.
 */
export function applyInject(ctx: ActionContext, action: ActionOf<"inject">): void {
  const target = findProcess(ctx.machine, action.into);
  if (!target) {
    ctx.fail(
      `there is no process called "${action.into}" on ${ctx.machine.id} yet. Start it earlier in the story, or name one from the baseline.`,
    );
  }
  const preview = toBytes(action.preview ?? "");
  const base = nextRegionBase(ctx.machine);
  ctx.machine.regions.push({
    pid: target.pid,
    base,
    size: action.size ?? 0x4000,
    protection: action.protection ?? "PAGE_EXECUTE_READWRITE",
    preview,
    origin: ctx.index,
  });
}
