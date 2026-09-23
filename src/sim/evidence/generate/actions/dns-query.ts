import type { ActionOf } from "../types";
import { type ActionContext } from "../world";

/**
 * A machine asks where a name lives. Name lookups are the cheapest trail in an investigation:
 * a machine asks before it connects, so the lookup is there even when the connection failed, and
 * the same odd name asked for every few minutes is a beacon showing its hand.
 */
export function applyDnsQuery(ctx: ActionContext, action: ActionOf<"dns-query">): void {
  ctx.log(
    "dns",
    {
      client: action.client ?? ctx.machine.ip,
      query: action.query,
      type: action.type ?? "A",
      rcode: action.answer === undefined ? "NXDOMAIN" : "NOERROR",
      ...(action.answer === undefined ? {} : { answer: action.answer }),
    },
    { what: `a lookup of ${action.query}` },
  );
}
