import type { ActionOf } from "../types";
import { type ActionContext } from "../world";
import { ephemeralPort } from "./shared";

/** The key=value line both firewall actions write. Kept here so the two say exactly the same. */
export function firewallFields(
  ctx: ActionContext,
  action: ActionOf<"firewall-allow"> | ActionOf<"firewall-block">,
  verdict: "allow" | "block",
): Record<string, string> {
  return {
    action: verdict,
    proto: action.proto ?? "tcp",
    src: action.src ?? ctx.machine.ip,
    spt: action.spt ?? ephemeralPort(ctx),
    dst: action.dst,
    dpt: action.dpt,
    ...(action.bytes === undefined ? {} : { bytes: action.bytes }),
    ...(action.rule === undefined ? {} : { rule: action.rule }),
  };
}
