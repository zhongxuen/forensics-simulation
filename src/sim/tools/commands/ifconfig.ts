import { errorLineText, stdout, success } from "../../core/output";
import { sessionHost } from "../../core/session";
import type { OutputLine } from "../../core/types";
import { formatIpv4, maskFor, parseCidr, parseIpv4 } from "../../net/ip";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { usage } from "./shared";

const NAME = "ifconfig";

/** A made-up but stable hardware address, built from the IP address so it never changes. */
const macFor = (ip: string) =>
  `02:00:${ip
    .split(".")
    .map((octet) => Number(octet).toString(16).padStart(2, "0"))
    .join(":")}`;

export const ifconfig: Tool = {
  name: NAME,
  category: "network",
  help: {
    oneLiner: "show this computer's network connections and the address it has on each.",
    usage: ["ifconfig [interface]"],
    description: [
      "A computer connects to networks through network interfaces: a cable socket or a wifi card, each with a name like eth0. lo is a pretend interface the computer uses to talk to itself.",
      "For each interface, the inet line shows the computer's IP address on that network. The netmask says how big the network is: 255.255.255.0 means every address that shares the first three numbers is on the same network. The broadcast address reaches every computer on it at once.",
    ],
    options: [{ flags: "-a", text: "Show every interface, even ones that are switched off." }],
    examples: [
      { command: "ifconfig", text: "Every network connection and its address." },
      { command: "ifconfig eth0", text: "Only the first network connection." },
    ],
    concept: [
      "Your own address tells you which network you're on, and so which range to explore next: a computer at 10.40.1.23 with netmask 255.255.255.0 sits on 10.40.1.0/24, the 256 addresses from 10.40.1.0 to 10.40.1.255.",
      "A computer with interfaces on two networks is a bridge between them. Defenders keep track of those, because they can let traffic cross a boundary that's meant to keep networks apart.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, [{ names: ["-a"], key: "all" }]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    void hasSwitch(parsed.value, "all");
    const host = sessionHost(state);
    const blocks: { name: string; lines: string[] }[] = host.interfaces.map((iface, i) => {
      const cidr = parseCidr(iface.subnet);
      const ip = parseIpv4(iface.ip) ?? 0;
      const mask = cidr ? maskFor(cidr.prefix) : 0xffffff00;
      const broadcast = formatIpv4((ip | (~mask >>> 0)) >>> 0);
      return {
        name: `eth${i}`,
        lines: [
          `eth${i}: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500`,
          `        inet ${iface.ip}  netmask ${formatIpv4(mask)}  broadcast ${broadcast}`,
          `        ether ${macFor(iface.ip)}  txqueuelen 1000  (Ethernet)`,
        ],
      };
    });
    blocks.push({
      name: "lo",
      lines: [
        "lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536",
        "        inet 127.0.0.1  netmask 255.0.0.0",
        "        loop  txqueuelen 1000  (Local Loopback)",
      ],
    });
    const [wanted] = parsed.value.positionals;
    const shown = wanted === undefined ? blocks : blocks.filter((block) => block.name === wanted);
    if (shown.length === 0) {
      return {
        state,
        output: [
          errorLineText(`${wanted}: error fetching interface information: Device not found`, {
            code: "ENOENT",
            path: wanted ?? "",
          }),
        ],
        events: [],
        exitCode: 1,
      };
    }
    const output: OutputLine[] = [];
    shown.forEach((block, i) => {
      if (i > 0) output.push(stdout(""));
      output.push(...block.lines.map(stdout));
    });
    return success(state, output);
  },
};
