import type { ActionOf } from "../types";
import { accountOf, logonIdOf, type ActionContext } from "../world";
import { domainOf } from "./shared";

/**
 * An account signs out. The logoff record carries the same logon id as the sign-in that started
 * the session, which is how a timeline pairs the two and works out how long someone was there.
 *
 * Leaves: security 4634.
 */
export function applyLogoff(ctx: ActionContext, action: ActionOf<"logoff">): void {
  const account = accountOf(ctx.machine, action.account, ctx.where);
  const logonId = logonIdOf(ctx.machine, account);
  ctx.log(
    "security",
    {
      TargetUserName: account.name,
      TargetDomainName: domainOf(ctx.machine),
      TargetLogonId: logonId,
      LogonType: account.logonType ?? "2",
    },
    { eventId: 4634, what: `${account.name} signed out` },
  );
  // The session is over, so the next sign-in gets a new id.
  account.logonId = undefined;
}
