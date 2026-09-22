import { columns, stdout, success } from "../../core/output";
import { sessionHost } from "../../core/session";
import type { SimState } from "../../core/types";
import { parseArgs, hasSwitch } from "../args";
import type { Tool } from "../types";
import { usage } from "./shared";

const NAME = "ps";

interface Process {
  readonly pid: number;
  readonly user: string;
  readonly tty: string;
  readonly command: string;
  readonly time: string;
  readonly mine: boolean;
}

/**
 * The programs running on the session's computer. There's no real scheduler: the list comes from
 * the host itself (a few system programs, one server program per service it offers, and the
 * learner's own shell), so it's the same every time and matches what a scan would find.
 */
function processes(state: SimState, tick: number): Process[] {
  const host = sessionHost(state);
  const user = state.session.user;
  const list: Process[] = [
    { pid: 1, user: "root", tty: "?", command: "/sbin/init", time: "00:00:03", mine: false },
    { pid: 2, user: "root", tty: "?", command: "[kthreadd]", time: "00:00:00", mine: false },
    {
      pid: 311,
      user: "root",
      tty: "?",
      command: "/usr/sbin/cron -f",
      time: "00:00:00",
      mine: false,
    },
    {
      pid: 322,
      user: "syslog",
      tty: "?",
      command: "/usr/sbin/rsyslogd -n",
      time: "00:00:01",
      mine: false,
    },
  ];
  host.services.forEach((service, i) => {
    list.push({
      pid: 400 + i * 17,
      user: service.port < 1024 ? "root" : "service",
      tty: "?",
      command: `/usr/sbin/${service.product} (port ${service.port})`,
      time: "00:00:00",
      mine: false,
    });
  });
  list.push(
    { pid: 1042, user, tty: "pts/0", command: "-bash", time: "00:00:00", mine: true },
    { pid: 1043 + tick, user, tty: "pts/0", command: "ps", time: "00:00:00", mine: true },
  );
  return list;
}

export const ps: Tool = {
  name: NAME,
  category: "system",
  help: {
    oneLiner: "list the programs running on this computer right now.",
    usage: ["ps", "ps aux", "ps -ef"],
    description: [
      "A running program is called a process. Each one has a number (the PID, process id), belongs to an account, and was started by a command. ps lists them.",
      "On its own, ps shows only the processes in your terminal: your shell and ps itself. ps aux or ps -ef shows every process on the computer, including the server programs that answer on its ports.",
    ],
    options: [
      { flags: "aux", text: "Every process, with its owner (BSD style, written without a dash)." },
      { flags: "-e, -A", text: "Every process." },
      { flags: "-f", text: "Full format: owner, parent and the whole command." },
    ],
    examples: [
      { command: "ps", text: "The processes in this terminal." },
      { command: "ps aux", text: "Everything running on this computer." },
    ],
    concept: [
      "Knowing what's running is how you spot what shouldn't be. An unfamiliar program, or a familiar name running as an unexpected account or from an odd folder like /tmp, is a classic sign that something has been installed without permission.",
      "Every process running as root is a risk if it has a weakness, because taking it over means taking over the computer. Defenders run services under their own limited accounts for that reason.",
    ],
  },

  run(args, state, ctx) {
    const bsd = args.length === 1 && /^a?u?x?$/.test(args[0] ?? "") && args[0] !== "";
    const parsed = parseArgs(bsd ? [] : args, [
      { names: ["-e", "-A"], key: "every" },
      { names: ["-f"], key: "full" },
      { names: ["-a"], key: "every" },
      { names: ["-u", "-x"], key: "full" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const list = processes(state, ctx.tick);
    const every = bsd || hasSwitch(parsed.value, "every");
    const shown = every ? list : list.filter((process) => process.mine);
    if (bsd) {
      const rows = shown.map((p) => [
        p.user,
        String(p.pid),
        "0.0",
        "0.1",
        p.tty,
        p.time,
        p.command,
      ]);
      return success(
        state,
        columns([["USER", "PID", "%CPU", "%MEM", "TTY", "TIME", "COMMAND"], ...rows]).map(stdout),
      );
    }
    if (hasSwitch(parsed.value, "full")) {
      const rows = shown.map((p) => [
        p.user,
        String(p.pid),
        p.pid === 1 ? "0" : "1",
        p.tty,
        p.time,
        p.command,
      ]);
      return success(
        state,
        columns([["UID", "PID", "PPID", "TTY", "TIME", "CMD"], ...rows]).map(stdout),
      );
    }
    const rows = shown.map((p) => [
      String(p.pid).padStart(5),
      p.tty,
      p.time,
      p.command.split(" ")[0]?.split("/").pop() ?? p.command,
    ]);
    return success(state, columns([["  PID", "TTY", "TIME", "CMD"], ...rows]).map(stdout));
  },
};
