import type { ActionOf } from "../types";
import { type ActionContext } from "../world";

/**
 * The machine's clock is wrong from here on. Everything it writes down afterwards — log records,
 * file times — carries the time it *believes* it is, while the story keeps the real instant.
 *
 * This is not a trick: a machine whose clock has drifted is ordinary, and an examiner who lines up
 * two sources without checking their clocks first builds a timeline that never happened. A case
 * using this should give the player a way to work the offset out.
 */
export function applyClockSkew(ctx: ActionContext, action: ActionOf<"clock-skew">): void {
  if (!Number.isFinite(action.minutes)) {
    ctx.fail("say how many minutes the clock is out by, as a whole number.");
  }
  ctx.machine.skewMinutes = action.minutes;
}
