import { errorLineText, stdout, success } from "../../core/output";
import { sessionHost } from "../../core/session";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { usage } from "./shared";

const NAME = "hostname";

export const hostname: Tool = {
  name: NAME,
  category: "network",
  help: {
    oneLiner: "show this computer's name on the network.",
    usage: ["hostname [options]"],
    description: [
      "Every computer on a network has a name, its hostname, as well as an address. Names are easier for people to remember: orders-01 instead of 10.40.2.15.",
      "hostname prints the short name. -f prints the full name, with the network's domain on the end (like orders-01.tumbleloaf.example), and -I prints this computer's addresses.",
    ],
    options: [
      { flags: "-f, --fqdn", text: "The full name, including the domain." },
      { flags: "-I, --all-ip-addresses", text: "Every address this computer has." },
      { flags: "-i, --ip-address", text: "The address that goes with the name." },
    ],
    examples: [
      { command: "hostname", text: "This computer's short name." },
      { command: "hostname -I", text: "This computer's addresses on the network." },
    ],
    concept: [
      "Names give a lot away. A name like backup-01 or payroll-db tells anyone who sees it what the computer is for, which helps defenders keep track, and helps attackers pick a target.",
      "Checking the name is also how you confirm you're on the computer you think you're on, before doing anything that matters.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, [
      { names: ["-f", "--fqdn", "--long"], key: "fqdn" },
      { names: ["-I", "--all-ip-addresses"], key: "allIps" },
      { names: ["-i", "--ip-address"], key: "ip" },
      { names: ["-s", "--short"], key: "short" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const host = sessionHost(state);
    const [newName] = parsed.value.positionals;
    if (newName !== undefined) {
      return {
        state,
        output: [
          errorLineText("hostname: you must be root to change the host name", {
            code: "EPERM",
            path: newName,
          }),
        ],
        events: [],
        exitCode: 1,
      };
    }
    if (hasSwitch(parsed.value, "allIps"))
      return success(state, [stdout(`${host.interfaces.map((i) => i.ip).join(" ")} `)]);
    if (hasSwitch(parsed.value, "ip"))
      return success(state, [stdout(host.interfaces[0]?.ip ?? "")]);
    if (hasSwitch(parsed.value, "fqdn")) return success(state, [stdout(host.hostname)]);
    return success(state, [stdout(host.hostname.split(".")[0] ?? host.hostname)]);
  },
};
