import type { ActionOf } from "../types";
import { type ActionContext } from "../world";
import { firewallFields } from "./firewall-fields";

/**
 * The firewall let a connection through, and wrote down that it did. An allowed connection to an
 * address nobody recognises is not proof of anything on its own — that is the point of the
 * lesson — but it puts a time and an address on the board.
 */
export function applyFirewallAllow(ctx: ActionContext, action: ActionOf<"firewall-allow">): void {
  ctx.log("firewall", firewallFields(ctx, action, "allow"), {
    what: `the firewall allowed ${action.dst}:${action.dpt}`,
  });
}
