import { stdout } from "../../core/output";
import type { Tool } from "../types";
import { wholeNumber } from "./shared";

const NAME = "exit";

export const exit: Tool = {
  name: NAME,
  category: "help",
  help: {
    oneLiner: "log out of the terminal, closing your session.",
    usage: ["exit [status]"],
    description: [
      "exit ends a shell session. On a computer you reached over the network, it logs you out and brings you back to your own machine. In a window on your own computer, it closes the window.",
      "This practice terminal stays open after exit, because there's nowhere to go back to: it prints logout, and you can keep typing.",
    ],
    examples: [{ command: "exit", text: "Log out of the session." }],
    concept: [
      "Logging out when you're done is part of working safely. A session left open on an unattended screen is an open door for anyone who walks past.",
      "Every sign-in and sign-out is usually written to a log, which is how defenders later work out who was on a computer and when.",
    ],
  },

  run(args, state) {
    const status = wholeNumber(args[0], 255) ?? 0;
    return { state, output: [stdout("logout")], events: [], exitCode: status };
  },
};
