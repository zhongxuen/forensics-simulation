import type { ActionOf } from "../types";
import { accountOf, logonIdOf, type ActionContext } from "../world";
import { domainOf, ephemeralPort, LOGON_TYPE_NUMBERS, logonProcessFor, subjectOf } from "./shared";

/**
 * An account signs in. This is the record a case usually turns on: who, from where, and in which
 * way. A remote logon (type 10) from an address nobody recognises is how Case 2 starts.
 *
 * Leaves: security 4624, and security 4672 as well when the session is an elevated one.
 */
export function applyLogon(ctx: ActionContext, action: ActionOf<"logon">): void {
  const account = accountOf(ctx.machine, action.account, ctx.where);
  // A new session gets a new logon id, which the logoff record then matches.
  account.logonId = undefined;
  account.logonType = LOGON_TYPE_NUMBERS[action.type];
  const logonId = logonIdOf(ctx.machine, account);
  const remote = action.from !== undefined;

  ctx.log(
    "security",
    {
      SubjectUserName: subjectOf(ctx, "-"),
      SubjectDomainName: domainOf(ctx.machine),
      TargetUserName: account.name,
      TargetDomainName: domainOf(ctx.machine),
      LogonType: LOGON_TYPE_NUMBERS[action.type],
      LogonProcessName: logonProcessFor(action.type),
      AuthenticationPackageName: action.type === "network" ? "NTLM" : "Negotiate",
      WorkstationName: action.workstation ?? ctx.machine.id.toUpperCase(),
      IpAddress: action.from ?? "-",
      IpPort: remote ? ephemeralPort(ctx) : "-",
      TargetLogonId: logonId,
    },
    { eventId: 4624, what: `${account.name} signed in` },
  );

  if (action.elevated === true) {
    ctx.log(
      "security",
      {
        SubjectUserName: account.name,
        SubjectDomainName: domainOf(ctx.machine),
        SubjectLogonId: logonId,
        PrivilegeList: "SeDebugPrivilege SeBackupPrivilege SeTakeOwnershipPrivilege",
      },
      { eventId: 4672, what: `${account.name} was given administrator privileges` },
    );
  }
}
