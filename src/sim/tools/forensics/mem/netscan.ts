/**
 * `mem netscan`: the network connections whose records are in the image, each with the process
 * that owns it (docs/plan/08-memory-tools.md).
 *
 * Like `psscan`, it searches the whole image rather than asking the operating system, so a
 * connection belonging to a hidden process still shows, with its owner's name. Connections are
 * printed in the order they were made, which is what makes a program checking in with the same
 * address every minute stand out.
 */
import { columns, plural, stdout } from "../../../core/output";
import type { OutputLine } from "../../../core/types";
import { showTime } from "../shared";
import {
  connectionRef,
  connectionsInOrder,
  ownerName,
  refLine,
  type MemReport,
  type MemRequest,
} from "./shared";

export function netscan(request: MemRequest): MemReport {
  const { image, pid } = request;
  const shown = connectionsInOrder(image).filter(
    ({ connection }) => pid === undefined || connection.pid === pid,
  );
  const header = ["PROTO", "LOCAL", "REMOTE", "STATE", "PID", "OWNER", "CREATED"];
  const table = columns([
    header,
    ...shown.map(({ connection }) => [
      connection.proto,
      connection.local,
      connection.remote,
      connection.state,
      String(connection.pid),
      ownerName(image, connection.pid),
      showTime(connection.createdAt, request.zone),
    ]),
  ]);
  const lines: OutputLine[] =
    shown.length === 0
      ? [stdout(pid === undefined ? "  (no connections)" : `  (no connections for pid ${pid})`)]
      : [
          stdout(`  ${table[0] as string}`),
          ...table
            .slice(1)
            .map((line, row) =>
              refLine(
                `  ${line}`,
                connectionRef(image, (shown[row] as (typeof shown)[number]).index),
              ),
            ),
        ];
  return {
    summary: [
      plural(shown.length, "connection"),
      ...(pid === undefined ? [] : [`pid ${pid}`]),
      `times in ${request.zone.label}`,
    ],
    lines: [
      ...lines,
      stdout(""),
      stdout("LOCAL is this computer's end, REMOTE the other end. LISTENING means waiting for"),
      stdout("someone to connect; the same remote address again and again, at a steady interval,"),
      stdout("is a program checking in with somewhere on a timer."),
    ],
    event: {
      type: "memory.scanned",
      image: image.id,
      view: "netscan",
      found: shown.length,
      ...(pid === undefined ? {} : { pid }),
    },
  };
}
