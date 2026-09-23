import type { ActionOf } from "../types";
import { addAccount, ensurePath, type ActionContext } from "../world";
import { domainOf, subjectOf } from "./shared";

/**
 * A new account is made on the machine. An account nobody at the client recognises, made in the
 * middle of the night, is one of the clearest findings a case can hand a beginner.
 *
 * Leaves: security 4720, the account itself, and its home folder on the disk.
 */
export function applyCreateAccount(ctx: ActionContext, action: ActionOf<"create-account">): void {
  if (ctx.machine.accounts.has(action.account.toLowerCase())) {
    ctx.fail(
      `there is already an account called "${action.account}" on ${ctx.machine.id}. Take it out of the machine's accounts, or create a differently named one.`,
    );
  }
  const account = addAccount(ctx.machine, action.account, ["Users"]);
  const by = action.by ?? subjectOf(ctx, "SYSTEM");

  ctx.log(
    "security",
    {
      SubjectUserName: by,
      SubjectDomainName: domainOf(ctx.machine),
      TargetUserName: account.name,
      TargetDomainName: domainOf(ctx.machine),
      SamAccountName: account.name,
    },
    { eventId: 4720, what: `the account ${account.name} was created` },
  );

  if (ctx.machine.disk) {
    const home = ensurePath(ctx.machine.disk, account.home, {
      at: ctx.recorded,
      owner: account.name,
      kind: "dir",
    });
    ctx.note({
      kind: "file",
      image: ctx.machine.disk.id,
      record: home.record,
      at: ctx.recorded,
      what: `${account.name}'s home folder`,
    });
  }
}
