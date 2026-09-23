import type { ActionOf } from "../types";
import { type ActionContext } from "../world";
import { firewallFields } from "./firewall-fields";

/**
 * The firewall refused a connection. A row of blocks at one address is somebody trying doors; a
 * block right after an allow is often the same program being cut off part way through.
 */
export function applyFirewallBlock(ctx: ActionContext, action: ActionOf<"firewall-block">): void {
  ctx.log("firewall", firewallFields(ctx, action, "block"), {
    what: `the firewall blocked ${action.dst}:${action.dpt}`,
  });
}
