import { errorLineText, stdout, success } from "../../core/output";
import { sessionMachine } from "../../core/session";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { extraArgument, usage } from "./shared";

const NAME = "id";

export const id: Tool = {
  name: NAME,
  category: "system",
  help: {
    oneLiner: "show your account's number and the groups it belongs to.",
    usage: ["id [options] [user]"],
    description: [
      "Behind every account name is a number, the user id (uid). root is always 0. Accounts also belong to groups: a group is a named set of accounts that share permissions, like everyone in the adm group being allowed to read certain logs.",
      "id prints your uid, your main group (gid), and every group you're in. Name another account to see theirs.",
    ],
    options: [
      { flags: "-u", text: "Only the user number." },
      { flags: "-g", text: "Only the main group's number." },
      { flags: "-G", text: "Only the numbers of every group." },
      { flags: "-n", text: "With -u, -g or -G: names instead of numbers." },
    ],
    examples: [
      { command: "id", text: "Your numbers and groups." },
      { command: "id root", text: "The admin account's numbers and groups." },
    ],
    concept: [
      "Group membership is often the quiet route to extra access. Being in a group like adm (can read logs) or sudo (can act as root) changes what an account can do, so reviewing who is in which group is part of any security check.",
      "Files have a group too. The middle three letters of a permission string like rw-r----- say what that group's members may do.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, [
      { names: ["-u", "--user"], key: "user" },
      { names: ["-g", "--group"], key: "group" },
      { names: ["-G", "--groups"], key: "groups" },
      { names: ["-n", "--name"], key: "name" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const [who, extra] = parsed.value.positionals;
    if (extra !== undefined) return extraArgument(NAME, extra, state);
    const { accounts } = sessionMachine(state);
    const name = who ?? state.session.user;
    const account = Object.hasOwn(accounts.users, name) ? accounts.users[name] : undefined;
    if (!account) {
      return {
        state,
        output: [
          errorLineText(`id: '${name}': no such user`, {
            code: "EINVAL",
            path: name,
            detail: "unknown-user",
            value: name,
          }),
        ],
        events: [],
        exitCode: 1,
      };
    }
    const gid = (group: string) => accounts.groups[group]?.gid ?? 0;
    const all = [account.group, ...account.groups];
    const named = hasSwitch(parsed.value, "name");
    if (hasSwitch(parsed.value, "user"))
      return success(state, [stdout(named ? account.name : String(account.uid))]);
    if (hasSwitch(parsed.value, "group"))
      return success(state, [stdout(named ? account.group : String(account.gid))]);
    if (hasSwitch(parsed.value, "groups")) {
      return success(state, [stdout(all.map((g) => (named ? g : String(gid(g)))).join(" "))]);
    }
    const groups = all.map((g) => `${gid(g)}(${g})`).join(",");
    return success(state, [
      stdout(
        `uid=${account.uid}(${account.name}) gid=${account.gid}(${account.group}) groups=${groups}`,
      ),
    ]);
  },
};
