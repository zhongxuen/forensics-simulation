import { stdout, success } from "../../core/output";
import { parseArgs } from "../args";
import type { Tool } from "../types";
import { extraArgument, usage } from "./shared";

const NAME = "whoami";

export const whoami: Tool = {
  name: NAME,
  category: "system",
  help: {
    oneLiner: "show which account you're using on this computer.",
    usage: ["whoami"],
    description: [
      "Everyone who uses a Linux computer does it through an account, also called a user. whoami prints the name of the account this terminal is running as.",
      "Your account decides what you're allowed to do: which files you can read or change, and which programs you can run. The all-powerful admin account is called root.",
    ],
    examples: [{ command: "whoami", text: "Print your account name, like recruit." }],
    concept: [
      '"Who am I on this machine?" is one of the first questions a security tester asks after getting into a computer, because the answer decides what they can reach. Getting from an ordinary account to root is called privilege escalation.',
      "Defenders follow a rule called least privilege: every account gets only the permissions it needs. Then even if someone gets into an account, they can't do much with it.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, []);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const [extra] = parsed.value.positionals;
    if (extra !== undefined) return extraArgument(NAME, extra, state);
    return success(state, [stdout(state.session.user)]);
  },
};
