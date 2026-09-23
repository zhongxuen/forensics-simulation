import type { ActionOf } from "../types";
import { type ActionContext } from "../world";
import { domainOf, ephemeralPort, LOGON_TYPE_NUMBERS } from "./shared";

/**
 * A sign-in that was refused. The account does not have to exist: somebody guessing names leaves
 * exactly these records, and a run of them before a successful sign-in is worth a report finding.
 *
 * Leaves: security 4625. Status `0xC000006D` is "the logon was not correct"; the sub-status says
 * which part was wrong (`0xC000006A`: the password; `0xC0000064`: no such account).
 */
export function applyFailedLogon(ctx: ActionContext, action: ActionOf<"failed-logon">): void {
  const known = ctx.machine.accounts.has(action.account.toLowerCase());
  ctx.log(
    "security",
    {
      TargetUserName: action.account,
      TargetDomainName: domainOf(ctx.machine),
      LogonType: LOGON_TYPE_NUMBERS[action.type],
      Status: "0xC000006D",
      SubStatus: known ? "0xC000006A" : "0xC0000064",
      FailureReason:
        action.reason ??
        (known ? "The password was not correct." : "There is no account with that name."),
      WorkstationName: ctx.machine.id.toUpperCase(),
      IpAddress: action.from ?? "-",
      IpPort: action.from === undefined ? "-" : ephemeralPort(ctx),
    },
    { eventId: 4625, what: `a sign-in as ${action.account} was refused` },
  );
}
