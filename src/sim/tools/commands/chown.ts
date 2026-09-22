import { stdout } from "../../core/output";
import { fileChanged, sessionFs, sessionMachine, withSessionFs } from "../../core/session";
import type { OutputLine, SimEvent } from "../../core/types";
import { chown as changeOwner, listDir, stat } from "../../fs/ops";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { fsErrorLine, usage } from "./shared";

const NAME = "chown";

export const chown: Tool = {
  name: NAME,
  category: "permissions",
  help: {
    oneLiner: "change which account owns a file, and which group it belongs to.",
    usage: ["chown [options] owner[:group] file...", "chown :group file..."],
    description: [
      "Every file has an owner (an account) and a group. The owner's permissions apply to the owner, the group's permissions to every account in that group. chown changes them: chown alex notes.txt gives notes.txt to alex, and chown alex:team notes.txt also puts it in the team group.",
      "Giving a file away is something only root can do, so on your own account you'll usually need sudo in front. An owner may move their own file into a group they belong to.",
    ],
    options: [
      { flags: "-R, --recursive", text: "Change a folder and everything inside it." },
      { flags: "-v, --verbose", text: "Say what changed for each file." },
    ],
    examples: [
      {
        command: "sudo chown root:root /srv/app.conf",
        text: "Make root the owner of a settings file.",
      },
      { command: "chown :team shared.txt", text: "Put your file in the team group." },
    ],
    concept: [
      "Ownership decides whose permissions apply. A settings file owned by an ordinary account can be changed by that account, and if a program run by root trusts that file, the ordinary account can steer what root does.",
      "Defenders make sure important files belong to the right account, and that only people who should share a file are in its group.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-R", "--recursive"], key: "recursive" },
      { names: ["-v", "--verbose", "-c", "--changes"], key: "verbose" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const [spec, ...files] = parsed.value.positionals;
    if (spec === undefined)
      return usage(NAME, { code: "MISSING_ARGUMENT", argument: "operand" }, state);
    if (files.length === 0) {
      return usage(NAME, { code: "MISSING_ARGUMENT", argument: `operand after '${spec}'` }, state);
    }
    const separator = spec.includes(":") ? ":" : spec.includes(".") ? "." : undefined;
    const [ownerPart, groupPart] = separator ? spec.split(separator, 2) : [spec, undefined];
    const { accounts } = sessionMachine(state);
    const owner = ownerPart === "" ? undefined : ownerPart;
    // "alex:" means alex, and alex's own main group.
    const group =
      groupPart === ""
        ? owner === undefined
          ? undefined
          : (accounts.users[owner]?.group ?? owner)
        : groupPart;

    let next = state;
    const output: OutputLine[] = [];
    const events: SimEvent[] = [];
    let failed = false;
    const change = (path: string, depth: number) => {
      const { vfs, ctx: fsCtx } = sessionFs(next, ctx.now);
      const before = stat(vfs, fsCtx, path);
      const changed = changeOwner(vfs, fsCtx, accounts, path, {
        ...(owner !== undefined && { owner }),
        ...(group !== undefined && { group }),
      });
      if (!changed.ok) {
        const verb =
          changed.error.code === "ENOENT" || changed.error.code === "EACCES"
            ? "cannot access"
            : "changing ownership of";
        output.push(fsErrorLine(NAME, changed.error, verb));
        failed = true;
        return;
      }
      next = withSessionFs(next, changed.value);
      const after = stat(changed.value, fsCtx, path);
      if (
        before.ok &&
        after.ok &&
        (before.value.owner !== after.value.owner || before.value.group !== after.value.group)
      ) {
        events.push(fileChanged(next, after.value.path, "owner"));
        if (hasSwitch(parsed.value, "verbose")) {
          output.push(
            stdout(
              `changed ownership of '${path}' from ${before.value.owner}:${before.value.group} to ${after.value.owner}:${after.value.group}`,
            ),
          );
        }
      }
      if (
        hasSwitch(parsed.value, "recursive") &&
        after.ok &&
        after.value.kind === "dir" &&
        depth < 32
      ) {
        const listing = listDir(changed.value, fsCtx, path);
        if (listing.ok) {
          for (const entry of listing.value)
            change(`${path.replace(/\/+$/, "")}/${entry.name}`, depth + 1);
        }
      }
    };
    for (const file of files) change(file, 0);
    return { state: next, output, events, exitCode: failed ? 1 : 0 };
  },
};
