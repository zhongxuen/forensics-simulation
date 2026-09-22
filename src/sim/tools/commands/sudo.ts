import { errorLineText, failure, stdout, success } from "../../core/output";
import { runTool } from "../../core/run-tool";
import { sessionHost, sessionMachine, withSession } from "../../core/session";
import type { SimState } from "../../core/types";
import type { Tool } from "../types";
import { usage } from "./shared";

const NAME = "sudo";

/** Groups whose members may use sudo, as on Debian/Ubuntu (sudo) and Red Hat (wheel). */
const SUDO_GROUPS = ["sudo", "wheel"];

/** Shell built-ins: they aren't programs, so sudo can't run them, just like the real one. */
const BUILT_INS = ["cd", "exit", "history", "help"];

/**
 * Whether the session's user may use sudo. The outcome is scripted by the scenario: membership of
 * the sudo (or wheel) group on this machine, exactly how real systems decide it. There's no
 * password prompt to answer, as if the account were set up not to need one.
 */
export function maySudo(state: SimState): boolean {
  const { accounts } = sessionMachine(state);
  const account = accounts.users[state.session.user];
  if (!account) return false;
  return (
    account.uid === 0 || [account.group, ...account.groups].some((g) => SUDO_GROUPS.includes(g))
  );
}

export const sudo: Tool = {
  name: NAME,
  category: "permissions",
  help: {
    oneLiner: "run one command as the admin account (root), if you're allowed to.",
    usage: ["sudo command [arguments...]", "sudo -l"],
    description: [
      'root is the admin account: it can read and change anything on the computer. sudo ("superuser do") runs a single command as root, then you\'re back to your own account.',
      "Only accounts the computer trusts may use it: on Linux, members of the sudo group. Everyone else gets told they're not in the sudoers file, and on a real computer the attempt is written to the security log.",
      "sudo -l asks what you're allowed to run. In this practice terminal there's no password to type: the practice machine decides from your groups.",
    ],
    options: [{ flags: "-l, --list", text: "Show what your account may run with sudo." }],
    examples: [
      {
        command: "sudo cat /etc/shadow",
        text: "Read the password file as root, if you're allowed.",
      },
      { command: "sudo -l", text: "Check whether you may use sudo at all." },
    ],
    concept: [
      "Admin powers are the prize in most attacks, so they're handed out carefully. Using sudo for single commands, instead of staying logged in as root, means a slip of the keyboard does less damage and every admin action is logged with the name of the person who ran it.",
      '"Who can use sudo?" is one of the first questions in a security review. Every extra account in the sudo group is another way to reach root.',
    ],
  },

  run(args, state, ctx) {
    const [first, ...rest] = args;
    if (first === undefined)
      return usage(NAME, { code: "MISSING_ARGUMENT", argument: "command" }, state);
    const host = sessionHost(state);
    const user = state.session.user;
    const denied = () => failure(NAME, { code: "SUDO_DENIED", user }, state);

    if (first === "-l" || first === "--list") {
      if (!maySudo(state)) return denied();
      return success(state, [
        stdout(`User ${user} may run the following commands on ${host.hostname.split(".")[0]}:`),
        stdout("    (ALL : ALL) ALL"),
      ]);
    }
    if (first.startsWith("-")) {
      // -i and -s would open a whole root shell; this practice terminal runs single commands.
      return usage(NAME, { code: "BAD_FLAG", flag: first }, state);
    }
    if (!maySudo(state)) return denied();
    if (BUILT_INS.includes(first)) {
      return {
        state,
        output: [
          errorLineText(`sudo: ${first}: command not found`, {
            code: "UNKNOWN_COMMAND",
            command: first,
          }),
        ],
        events: [],
        exitCode: 1,
      };
    }

    // Run the command as root, then come back as yourself.
    const { accounts } = sessionMachine(state);
    const rootHome = accounts.users.root?.home ?? "/root";
    const asRoot = withSession(state, {
      user: "root",
      env: { ...state.session.env, USER: "root", HOME: rootHome, LOGNAME: "root", SUDO_USER: user },
    });
    const result = runTool(asRoot, [first, ...rest], {
      registry: ctx.registry,
      now: ctx.now,
      tty: ctx.tty,
      ...(ctx.stdin !== undefined && { stdin: ctx.stdin }),
    });
    const back = withSession(result.state, {
      user: state.session.user,
      env: state.session.env,
    });
    // sudo's own run reports the error lines; keep the inner command's run event, not duplicates.
    const events = result.events.filter((event) => event.type !== "command.error");
    return { ...result, state: back, events };
  },
};
