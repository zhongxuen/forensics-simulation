/**
 * `mem strings`: the readable text in one process's memory (docs/plan/08-memory-tools.md). It is
 * meant to be `strings` from file 07 (docs/plan/07-carve-strings-logq.md), scoped to a pid.
 *
 * TODO(file 07): `strings` isn't merged yet. Once it is, run it over the image's strings for
 * `request.pid` (or all of them) here and give each line its process ref, instead of this note.
 */
import { stdout } from "../../../core/output";
import type { MemReport, MemRequest } from "./shared";

export function strings(request: MemRequest): MemReport {
  const { image, pid } = request;
  return {
    summary: ["not available yet"],
    lines: [
      stdout("  Reading the text out of memory isn't built yet: it arrives with the strings tool."),
      stdout("  Until then, the command lines hold most of the text worth reading:"),
      stdout(""),
      stdout(`    mem cmdline ${image.id}${pid === undefined ? "" : ` --pid ${pid}`}`),
    ],
    // No event until it reads anything: an objective waiting on strings shouldn't tick for this.
  };
}
