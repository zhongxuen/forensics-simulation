import type { ActionOf } from "../types";
import { accountOf, type ActionContext } from "../world";
import { accountSid, domainOf, subjectOf } from "./shared";

/**
 * An account is added to a group. Added to the administrators group, it can do anything on the
 * machine, so this record next to a new account is the "and then they gave it the keys" beat.
 *
 * Leaves: security 4732.
 */
export function applyAddToGroup(ctx: ActionContext, action: ActionOf<"add-to-group">): void {
  const account = accountOf(ctx.machine, action.account, ctx.where);
  account.groups.add(action.group);
  ctx.log(
    "security",
    {
      SubjectUserName: action.by ?? subjectOf(ctx, "SYSTEM"),
      SubjectDomainName: domainOf(ctx.machine),
      MemberName: `${domainOf(ctx.machine)}\\${account.name}`,
      MemberSid: accountSid(ctx.machine, account.name),
      TargetUserName: action.group,
      TargetDomainName: domainOf(ctx.machine),
    },
    { eventId: 4732, what: `${account.name} was added to ${action.group}` },
  );
}
