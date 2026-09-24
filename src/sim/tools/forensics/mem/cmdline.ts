/**
 * `mem cmdline`: the full command line each process was started with (docs/plan/08-memory-tools.md).
 *
 * A process's name is whatever its file is called, and anyone can call a file `svchost.exe`. The
 * command line says where the file really is and what it was asked to do, which is where odd
 * folders, encoded commands and addresses give things away. It reads every process a scan finds,
 * so a hidden one shows here too. An exited process has handed its memory back, so its command
 * line is gone.
 */
import { columns, plural, stdout } from "../../../core/output";
import type { OutputLine } from "../../../core/types";
import {
  processMark,
  processRef,
  refLine,
  scanProcesses,
  type MemReport,
  type MemRequest,
} from "./shared";

export function cmdline(request: MemRequest): MemReport {
  const { image, pid } = request;
  const shown = scanProcesses(image).filter((process) => pid === undefined || process.pid === pid);
  const table = columns([
    ["PID", "NAME", "COMMAND LINE"],
    ...shown.map((process) => [
      String(process.pid),
      process.name,
      process.exitedAt !== undefined
        ? "(not in memory: the process had exited before the capture)"
        : process.cmdline || "(none: this is Windows itself, which no command starts)",
    ]),
  ]);
  const lines: OutputLine[] = [
    stdout(`  ${table[0] as string}`),
    ...table.slice(1).map((line, row) => {
      const process = shown[row] as (typeof shown)[number];
      const mark = processMark(process) === "unlinked" ? "   [unlinked]" : "";
      return refLine(`  ${line}${mark}`, processRef(image, process.pid));
    }),
  ];
  return {
    summary: [
      plural(shown.length, "process", "processes"),
      ...(pid === undefined ? [] : [`pid ${pid}`]),
    ],
    lines: [
      ...lines,
      stdout(""),
      stdout("A name is only what the file is called. The path says where it really lives, and"),
      stdout("the arguments after it say what it was asked to do."),
    ],
    event: {
      type: "memory.inspected",
      image: image.id,
      view: "cmdline",
      ...(pid === undefined ? {} : { pid }),
    },
  };
}
