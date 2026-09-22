import { stdout, success } from "../../core/output";
import { sessionHost } from "../../core/session";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { extraArgument, usage } from "./shared";

const NAME = "uname";

export const uname: Tool = {
  name: NAME,
  category: "system",
  help: {
    oneLiner: "show what kind of computer this is: its operating system, name and version.",
    usage: ["uname [options]"],
    description: [
      "The operating system is the main program that runs a computer and everything on it. Linux is one; Windows and macOS are others. The core of the operating system is called the kernel.",
      "uname on its own prints the kernel's name. uname -a prints everything: kernel name, the computer's network name, the kernel version, the type of processor, and the operating system.",
    ],
    options: [
      { flags: "-a, --all", text: "Everything below, on one line." },
      { flags: "-s", text: "The kernel's name (the default)." },
      { flags: "-n", text: "The computer's name on the network." },
      { flags: "-r", text: "The kernel's version number." },
      { flags: "-m", text: "The type of processor." },
      { flags: "-o", text: "The operating system." },
    ],
    examples: [
      { command: "uname", text: "Which kernel is running: Linux." },
      { command: "uname -a", text: "Every detail about this computer's system." },
    ],
    concept: [
      "Versions matter because weaknesses are found in specific versions. Once a security tester knows the exact kernel version, they can check it against lists of known weaknesses; defenders check the same lists and install updates (patches) to fix them.",
      "Keeping systems patched is one of the most effective protections there is. Many real break-ins use weaknesses that already had a fix available.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, [
      { names: ["-a", "--all"], key: "all" },
      { names: ["-s", "--kernel-name"], key: "s" },
      { names: ["-n", "--nodename"], key: "n" },
      { names: ["-r", "--kernel-release"], key: "r" },
      { names: ["-m", "--machine"], key: "m" },
      { names: ["-o", "--operating-system"], key: "o" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const [extra] = parsed.value.positionals;
    if (extra !== undefined) return extraArgument(NAME, extra, state);
    const host = sessionHost(state);
    const version = host.os.version ?? "6.8";
    const release = /^\d+\.\d+$/.test(version) ? `${version}.0-sim` : version;
    const kernel = host.os.family === "linux" ? "Linux" : host.os.name;
    const fields: Record<string, string> = {
      s: kernel,
      n: host.hostname.split(".")[0] ?? host.hostname,
      r: release,
      v: "#1 SMP PREEMPT_DYNAMIC",
      m: "x86_64",
      o: host.os.family === "linux" ? "GNU/Linux" : host.os.name,
    };
    const all = hasSwitch(parsed.value, "all");
    const picked = all
      ? ["s", "n", "r", "v", "m", "o"]
      : ["s", "n", "r", "m", "o"].filter((key) => hasSwitch(parsed.value, key));
    const keys = picked.length > 0 ? picked : ["s"];
    return success(state, [stdout(keys.map((key) => fields[key] ?? "").join(" "))]);
  },
};
