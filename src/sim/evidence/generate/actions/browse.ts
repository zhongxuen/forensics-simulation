import type { ActionOf } from "../types";
import { formatInstant } from "../../time";
import { ensurePath, writeContent, type ActionContext } from "../world";
import { subjectOf } from "./shared";

/**
 * Somebody opens a page. The machine writes a line into that account's browsing history, in its
 * own local time (which is why a history file and a log can disagree by an hour), and asks the
 * name server where the site is.
 *
 * Leaves: the history file, and a dns record.
 */
export function applyBrowse(ctx: ActionContext, action: ActionOf<"browse">): void {
  const account = action.account ?? subjectOf(ctx, "");
  if (account === "") {
    ctx.fail("say which account was browsing: add account, or give the action a user actor.");
  }
  const known = ctx.machine.accounts.get(account.toLowerCase());
  if (!known) {
    ctx.fail(`there is no account called "${account}" on ${ctx.machine.id}.`);
  }

  const host = hostOf(action.url);
  if (ctx.machine.disk) {
    const path = `${known.home}\\AppData\\Local\\Web\\history.log`;
    const file = ensurePath(ctx.machine.disk, path, {
      at: ctx.recorded,
      owner: known.name,
      kind: "file",
      content: "# One line per page opened: local time, then the address.\n",
    });
    const line = `${formatInstant(ctx.recorded, { zone: ctx.machine.zone })} ${action.url}\n`;
    writeContent(
      ctx.machine.disk,
      file,
      new TextDecoder().decode(file.content) + line,
      ctx.recorded,
    );
    ctx.note({
      kind: "file",
      image: ctx.machine.disk.id,
      record: file.record,
      at: ctx.recorded,
      what: `${known.name}'s browsing history`,
    });
  }

  ctx.log(
    "dns",
    { client: ctx.machine.ip, query: host, type: "A", rcode: "NOERROR" },
    { what: `a lookup of ${host}` },
  );
}

/** "https://updates.example/patch" → "updates.example". */
function hostOf(url: string): string {
  const withoutScheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return withoutScheme.split(/[/?#]/)[0] ?? withoutScheme;
}
