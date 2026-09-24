/**
 * `mem info`, `mem ps`, `mem psscan` and `mem pstree`: what the image is, and the processes in it
 * read three ways (docs/plan/08-memory-tools.md).
 *
 * `ps` walks the active process list, the chain of records the operating system keeps of what is
 * running. Code that wants to hide can take its own record out of that chain and keep running, so
 * `psscan` doesn't trust the chain: it searches the whole image for anything shaped like a process
 * record. The difference between the two lists is the lesson.
 */
import { columns, plural, stdout } from "../../../core/output";
import type { OutputLine } from "../../../core/types";
import { formatInstant } from "../../../evidence/time";
import type { MemoryImage, MemoryProcess } from "../../../evidence/types";
import { groupDigits, showTime } from "../shared";
import {
  listProcesses,
  processMark,
  processRef,
  refLine,
  scanProcesses,
  type MemReport,
  type MemRequest,
} from "./shared";

/** `mem info`: the host, the moment it was captured, and what the image holds. */
export function info({ image, hostZone }: MemRequest): MemReport {
  const scanned = scanProcesses(image);
  const listed = listProcesses(image);
  const rows: string[][] = [
    ["Image", image.id],
    ["Host", image.host],
    ["Captured", formatInstant(image.capturedAt)],
    ...(hostZone
      ? [
          [
            "",
            `${formatInstant(image.capturedAt, { zone: hostZone })} on the host's clock (${hostZone})`,
          ],
        ]
      : []),
    [
      "Processes",
      `${groupDigits(scanned.length)} found by a scan, ${groupDigits(listed.length)} in the active list`,
    ],
    ["Connections", groupDigits(image.connections.length)],
    [
      "Regions",
      `${groupDigits(image.regions.length)} stretches of memory with their protection recorded`,
    ],
  ];
  const lines: OutputLine[] = [
    ...columns(rows, 3).map((line) => stdout(`  ${line}`)),
    stdout(""),
    stdout("A memory image is a snapshot of one moment: what it holds was true when it was"),
    stdout("captured, and says nothing about after. Start with: mem ps " + image.id),
  ];
  return {
    summary: [image.host],
    lines,
    event: { type: "memory.inspected", image: image.id, view: "info" },
  };
}

const PROCESS_HEADER = ["PID", "PPID", "NAME", "CREATED", "USER"];

const processCells = (process: MemoryProcess, request: MemRequest): string[] => [
  String(process.pid),
  String(process.ppid),
  process.name,
  showTime(process.createdAt, request.zone),
  process.user,
];

/** A table whose every row after the header shows one process and carries its ref. */
function processTable<T extends { readonly process: MemoryProcess }>(
  image: MemoryImage,
  header: readonly string[],
  rows: readonly T[],
  cells: (row: T) => readonly string[],
): OutputLine[] {
  if (rows.length === 0) return [stdout("  (no processes)")];
  const table = columns([header, ...rows.map(cells)]);
  return [
    stdout(`  ${table[0] as string}`),
    ...table
      .slice(1)
      .map((line, index) =>
        refLine(`  ${line}`, processRef(image, (rows[index] as T).process.pid)),
      ),
  ];
}

const asRows = (processes: readonly MemoryProcess[]) => processes.map((process) => ({ process }));

/** `mem ps`: the active process list, as the operating system itself would report it. */
export function ps(request: MemRequest): MemReport {
  const { image } = request;
  const listed = listProcesses(image);
  return {
    summary: [
      plural(listed.length, "process", "processes"),
      "the active list",
      `times in ${request.zone.label}`,
    ],
    lines: [
      ...processTable(image, PROCESS_HEADER, asRows(listed), ({ process }) =>
        processCells(process, request),
      ),
      stdout(""),
      stdout("This is the list the operating system keeps of what is running. Something that"),
      stdout("wants to hide can take itself out of it. To look past the list:"),
      stdout(`mem psscan ${image.id}`),
    ],
    event: { type: "memory.listed", image: image.id, view: "ps", processes: listed.length },
  };
}

/** `mem psscan`: every process record anywhere in the image, marked when the list leaves it out. */
export function psscan(request: MemRequest): MemReport {
  const { image } = request;
  const scanned = scanProcesses(image);
  const unlinked = scanned.filter((process) => process.unlinked).length;
  const exited = scanned.filter((process) => process.exitedAt !== undefined).length;
  const tally = [
    plural(scanned.length, "process", "processes"),
    ...(unlinked > 0 ? [`${unlinked} unlinked`] : []),
    ...(exited > 0 ? [`${exited} exited`] : []),
  ].join(", ");
  return {
    summary: [tally, `times in ${request.zone.label}`],
    lines: [
      ...processTable(
        image,
        [...PROCESS_HEADER, "EXITED", "NOTE"],
        asRows(scanned),
        ({ process }) => [
          ...processCells(process, request),
          process.exitedAt === undefined ? "-" : showTime(process.exitedAt, request.zone),
          processMark(process),
        ],
      ),
      stdout(""),
      stdout(
        "unlinked: still running, but missing from the active list, so mem ps doesn't show it.",
      ),
      stdout("exited:   finished before the capture; its record hadn't been cleared away yet."),
    ],
    event: {
      type: "memory.scanned",
      image: image.id,
      view: "psscan",
      found: scanned.length,
      unlinked,
    },
  };
}

/** `mem pstree`: the active list again, with each process indented under the one that started it. */
export function pstree(request: MemRequest): MemReport {
  const { image } = request;
  const listed = listProcesses(image);
  return {
    summary: [
      plural(listed.length, "process", "processes"),
      "the active list",
      `times in ${request.zone.label}`,
    ],
    lines: [
      ...processTable(image, ["NAME", "PID", "PPID", "CREATED"], treeOrder(listed), (row) => [
        `${"  ".repeat(row.depth)}${row.process.name}`,
        String(row.process.pid),
        String(row.process.ppid),
        showTime(row.process.createdAt, request.zone),
      ]),
      stdout(""),
      stdout("Each process sits under its parent, the process that started it. Windows starts its"),
      stdout("own services in a known order, so a familiar name under an unfamiliar parent is"),
      stdout("worth a second look."),
    ],
    event: { type: "memory.listed", image: image.id, view: "pstree", processes: listed.length },
  };
}

interface TreeRow {
  readonly process: MemoryProcess;
  readonly depth: number;
}

/**
 * Parents first, each child under its parent in the order they started. A process whose parent
 * isn't in the list (it exited, or it is hidden) starts a tree of its own. A record claiming to be
 * its own ancestor is printed once, where it is first reached.
 */
function treeOrder(processes: readonly MemoryProcess[]): readonly TreeRow[] {
  const pids = new Set(processes.map((process) => process.pid));
  const rows: TreeRow[] = [];
  const seen = new Set<MemoryProcess>();
  const visit = (process: MemoryProcess, depth: number) => {
    if (seen.has(process)) return;
    seen.add(process);
    rows.push({ process, depth });
    for (const child of processes) {
      if (child.ppid === process.pid && child !== process) visit(child, depth + 1);
    }
  };
  for (const process of processes) {
    if (process.ppid === process.pid || !pids.has(process.ppid)) visit(process, 0);
  }
  // Anything left is in a loop of parents; show it rather than lose it.
  for (const process of processes) visit(process, 0);
  return rows;
}
