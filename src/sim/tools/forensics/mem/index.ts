/**
 * mem: reads a memory image, the other half of the evidence a case hands over
 * (docs/plan/08-memory-tools.md). One command with a subcommand per question: what is this image,
 * what was running, what was hiding, who started what, who was talking to where, what was each
 * process asked to do, and where is there code that no file explains.
 *
 * Every line that shows a process, a connection or a region carries its `mem:` ref, so `pin` can
 * put it on the case board. A memory image is read, never changed, so there is no write-blocker
 * here and no way to spoil it.
 */
import { columns, failure, stdout } from "../../../core/output";
import type { OutputLine, SimState } from "../../../core/types";
import { formatInstant } from "../../../evidence/time";
import { optionValue, parseArgs } from "../../args";
import type { Tool } from "../../types";
import { banner, delivered, displayZone, requireEvidence, ZONE_OPTION } from "../shared";
import { cmdline } from "./cmdline";
import { malfind } from "./malfind";
import { netscan } from "./netscan";
import { info, ps, psscan, pstree } from "./processes";
import { findMemory, parsePid, requireProcess, type MemReport, type MemRequest } from "./shared";
import { strings } from "./strings";

const NAME = "mem";

interface Subcommand {
  readonly run: (request: MemRequest) => MemReport;
  /** Whether `--pid` narrows it to one process. */
  readonly takesPid: boolean;
  /** One line for `mem` on its own. */
  readonly text: string;
}

/** The subcommands, in the order an examiner usually runs them. */
const SUBCOMMANDS: Readonly<Record<string, Subcommand>> = {
  info: { run: info, takesPid: false, text: "which computer, when it was captured, what it holds" },
  ps: { run: ps, takesPid: false, text: "the active process list, as Windows kept it" },
  psscan: {
    run: psscan,
    takesPid: false,
    text: "every process found by scanning, hidden ones too",
  },
  pstree: { run: pstree, takesPid: false, text: "the active list as a tree: who started whom" },
  netscan: {
    run: netscan,
    takesPid: true,
    text: "network connections and the process behind each",
  },
  cmdline: {
    run: cmdline,
    takesPid: true,
    text: "the full command line each process started with",
  },
  malfind: {
    run: malfind,
    takesPid: true,
    text: "memory that can be written and run, with no file behind it",
  },
  strings: {
    run: strings,
    takesPid: true,
    text: "readable text in a process's memory (not available yet)",
  },
};

export const mem: Tool = {
  name: NAME,
  category: "investigate",
  help: {
    oneLiner:
      "look inside a memory image: what was running, what it was connected to, and what hid.",
    usage: [
      "mem",
      "mem info <image>",
      "mem ps <image>          mem psscan <image>          mem pstree <image>",
      "mem netscan <image> [--pid n]",
      "mem cmdline <image> [--pid n]",
      "mem malfind <image> [--pid n]",
      "mem strings <image> [--pid n]",
    ],
    description: [
      "A memory image is a copy of a computer's working memory (its RAM), taken while it was running. A disk shows what was stored; memory shows what was happening at the moment of the capture: every running program, called a process, what each was connected to, and the code each was running. Turn the computer off and all of it is gone, which is why it is captured first.",
      "Give mem a subcommand and the image, named after the computer it came from, such as qf-srv-01-mem (or qf-srv-01). mem on its own lists the images this case has.",
      "info says which computer and when. ps walks the active process list, the list Windows keeps of what is running. psscan searches the whole image for processes instead of trusting that list, and marks the ones the list leaves out: unlinked (still running, taken out of the list) and exited (finished, not yet cleared away). pstree draws the list as a family tree, each process under its parent, the process that started it.",
      "netscan shows each network connection: this computer's end (LOCAL), the other end (REMOTE), its state, and the process that owns it. cmdline shows the full command each process was started with. malfind finds memory that can be both written and run with no file on disk behind it, and prints its first 64 bytes. --pid narrows any of those three to one process.",
      "Times are in UTC unless you ask for --zone local. These outputs are a teaching model: a real memory image is raw bytes, and real tools rebuild these lists from structures whose layout differs from one Windows build to the next. The questions you ask are the same.",
    ],
    options: [
      { flags: "--pid <n>", text: "Only this process (netscan, cmdline, malfind, strings)." },
      {
        flags: "--zone <utc|local>",
        text: "Show times in UTC (the default) or as the computer's own clock showed them.",
      },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      {
        command: "mem info qf-srv-01-mem",
        text: "Which computer, and the moment it was captured.",
      },
      {
        command: "mem psscan qf-srv-01-mem",
        text: "Every process in the image. Compare it with mem ps.",
      },
      { command: "mem pstree qf-srv-01-mem", text: "Who started whom." },
      {
        command: "mem netscan qf-srv-01-mem --pid 4120",
        text: "The connections one process made.",
      },
      {
        command: "mem malfind qf-srv-01-mem",
        text: "Writable, runnable memory with no file behind it.",
      },
    ],
    concept: [
      "A list can be tampered with. Code that wants to hide takes its own entry out of the active process list and keeps running, so anything that asks the list (ps, and Task Manager on a live machine) never sees it. A scan reads every record in memory that looks like a process, list or no list. When psscan shows something ps doesn't, and it isn't marked exited, you have found something that was hiding.",
      "Parents matter. Windows starts its own services in a known order: services.exe starts every svchost.exe. An svchost.exe whose parent is explorer.exe (the desktop, which a person's double-click starts things from) is a familiar name in an unfamiliar place, and worth a look at its command line.",
      "A connection that repeats is a heartbeat. Software that an attacker left behind usually checks in with them on a timer, so netscan shows the same remote address again and again, a steady number of seconds apart. Note the address; never connect to it. Looking back at an attacker is still touching them, and that isn't the job.",
      "How to read malfind. Every region it prints can be written and run, with no file behind it, and two very different things look like that. Injected code (MITRE ATT&CK T1055) sits inside a process that has no reason to make code, such as a system service, and often starts with MZ, the first two letters of every Windows program file, because a whole program was copied into memory. A runtime compiler, often called a JIT, the part of .NET, Java or a browser that turns code into machine instructions while the program runs, makes regions like this on purpose, in a process that loads such a runtime, and its bytes start in the middle of instructions, with no file header. Check which process a region is in, what its command line says, and what its first bytes are before you call it either.",
      "Memory is the most fragile evidence there is (the order of volatility says to capture it first), and a capture is one moment. Anything that happened before it and left no trace in memory needs the disk and the logs.",
    ],
    realWorld: [
      "Volatility 3, the open-source memory forensics framework: windows.info, windows.pslist, windows.psscan, windows.pstree, windows.netscan, windows.cmdline, windows.malfind and windows.vadinfo are the plugins these subcommands stand in for. mem strings stands in for strings run over a process's memory.",
      "Volatility Workbench, a Windows front end for Volatility.",
      "MemProcFS, which shows a memory image as folders and files; and Redline, a memory and live-response collector.",
      "Capturing the memory in the first place is done with a tool such as WinPmem, DumpIt or Magnet RAM Capture, before the machine is turned off.",
    ],
  },

  run(args, state) {
    const parsed = parseArgs(args, [
      { names: ["--pid"], key: "pid", takesValue: true },
      ZONE_OPTION,
    ]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [sub, name, extra] = parsed.value.positionals;
    const session = requireEvidence(state);
    if (!session.ok) return failure(NAME, session.error, state);
    if (sub === undefined) return overview(state);

    const subcommand = Object.hasOwn(SUBCOMMANDS, sub) ? SUBCOMMANDS[sub] : undefined;
    if (!subcommand) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "subcommand", value: sub, reason: "unknown-value" },
        state,
      );
    }
    if (name === undefined) {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "image" }, state);
    }
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "image", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const pidValue = optionValue(parsed.value, "pid");
    if (pidValue !== undefined && !subcommand.takesPid) {
      return failure(NAME, { code: "BAD_FLAG", flag: "--pid" }, state);
    }
    const zone = displayZone(session.value, parsed.value);
    if (!zone.ok) return failure(NAME, zone.error, state);
    const image = findMemory(session.value, name);
    if (!image.ok) return failure(NAME, image.error, state);

    let pid: number | undefined;
    if (pidValue !== undefined) {
      const number = parsePid(pidValue);
      if (!number.ok) return failure(NAME, number.error, state);
      const process = requireProcess(image.value, number.value);
      if (!process.ok) return failure(NAME, process.error, state);
      pid = process.value.pid;
    }

    const hostZone = session.value.set.zones.disk;
    const report = subcommand.run({
      image: image.value,
      zone: zone.value,
      ...(pid === undefined ? {} : { pid }),
      ...(hostZone === undefined ? {} : { hostZone }),
    });
    const output: OutputLine[] = [
      banner(`${NAME} ${sub}`, image.value.id, ...report.summary),
      stdout(""),
      ...report.lines,
    ];
    return delivered(state, [NAME, ...args].join(" "), output, report.event ? [report.event] : []);
  },
};

/** `mem` on its own: the memory images this case has, and what each subcommand asks. */
function overview(state: SimState) {
  const images = state.evidence?.set.memory ?? [];
  const output: OutputLine[] = [banner(NAME, "memory images attached to this case"), stdout("")];
  if (images.length === 0) {
    output.push(
      stdout("  (this case has no memory images: its evidence is the disk and the logs)"),
    );
  } else {
    const table = columns([
      ["IMAGE", "HOST", "CAPTURED"],
      ...images.map((image) => [image.id, image.host, formatInstant(image.capturedAt)]),
    ]);
    output.push(...table.map((line) => stdout(`  ${line}`)));
  }
  output.push(
    stdout(""),
    stdout("Ask it one question at a time: mem <subcommand> <image>"),
    stdout(""),
  );
  const rows = columns(Object.entries(SUBCOMMANDS).map(([sub, { text }]) => [sub, text]));
  output.push(...rows.map((line) => stdout(`  ${line}`)));
  return delivered(state, NAME, output);
}
