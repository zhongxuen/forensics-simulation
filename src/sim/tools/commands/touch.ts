import { fileChanged, sessionFs, withSessionFs } from "../../core/session";
import type { OutputLine, SimEvent } from "../../core/types";
import { realpath, stat, touch as touchFile } from "../../fs/ops";
import { parseArgs } from "../args";
import type { Tool } from "../types";
import { fsErrorLine, usage } from "./shared";

const NAME = "touch";

export const touch: Tool = {
  name: NAME,
  category: "change",
  help: {
    oneLiner: "make a new, empty file, or update an existing file's last-changed time.",
    usage: ["touch file..."],
    description: [
      "touch creates each file you name if it doesn't exist yet, empty. If the file already exists, touch leaves what's inside alone and updates its time: the last-changed time that ls -l shows.",
      "You need permission to add files to the folder, or to change the file if it's already there.",
    ],
    examples: [
      { command: "touch report.txt", text: "Make an empty file called report.txt." },
      { command: "touch a.txt b.txt", text: "Make two files at once." },
    ],
    concept: [
      "Every file remembers when it last changed, and investigators rely on those times to work out what happened in what order. That list of events in order is called a timeline.",
      "Because touch can change a file's time, attackers sometimes use tools like it to make their changes look older. Defenders don't trust file times alone: they check them against the logs.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, []);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const files = parsed.value.positionals;
    if (files.length === 0) {
      return usage(NAME, { code: "MISSING_ARGUMENT", argument: "file operand" }, state);
    }
    let next = state;
    const output: OutputLine[] = [];
    const events: SimEvent[] = [];
    for (const file of files) {
      const { vfs, ctx: fsCtx } = sessionFs(next, ctx.now);
      const existed = stat(vfs, fsCtx, file).ok;
      const touched = touchFile(vfs, fsCtx, file);
      if (!touched.ok) {
        output.push(fsErrorLine(NAME, touched.error, "cannot touch"));
        continue;
      }
      next = withSessionFs(next, touched.value);
      const path = realpath(touched.value, fsCtx, file);
      if (path.ok) events.push(fileChanged(next, path.value, existed ? "modified" : "created"));
    }
    return { state: next, output, events, exitCode: output.length > 0 ? 1 : 0 };
  },
};
