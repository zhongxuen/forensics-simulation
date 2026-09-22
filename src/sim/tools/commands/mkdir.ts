import { stdout } from "../../core/output";
import { fileChanged, sessionFs, withSessionFs } from "../../core/session";
import type { OutputLine, SimEvent } from "../../core/types";
import { parseOctalMode } from "../../fs/mode";
import { mkdir as makeDir, realpath, stat } from "../../fs/ops";
import { hasSwitch, optionValue, parseArgs } from "../args";
import type { Tool } from "../types";
import { fsErrorLine, usage } from "./shared";

const NAME = "mkdir";

export const mkdir: Tool = {
  name: NAME,
  category: "change",
  help: {
    oneLiner: "make a new folder.",
    usage: ["mkdir [options] folder..."],
    description: [
      "mkdir (make directory) creates a folder with the name you give it, inside the folder you're in, or wherever the path points.",
      "To make a folder inside a folder that doesn't exist yet, add -p: mkdir -p reports/2026/march makes all three at once.",
    ],
    options: [
      {
        flags: "-p, --parents",
        text: "Make any missing folders along the way, and don't complain if it's already there.",
      },
      {
        flags: "-m, --mode <mode>",
        text: "Set the new folder's permissions, like 700 (only you can get in).",
      },
      { flags: "-v, --verbose", text: "Say each folder it makes." },
    ],
    examples: [
      { command: "mkdir evidence", text: "Make a folder called evidence." },
      { command: "mkdir -p case/logs", text: "Make case, and logs inside it." },
      { command: "mkdir -m 700 private", text: "Make a folder only you can open." },
    ],
    concept: [
      "Keeping findings organised matters in security work. Investigators keep copies of evidence in their own folders, so the originals stay untouched and nothing gets mixed up.",
      "A new folder's permissions decide who can look inside. A folder for private notes should be locked to you (mode 700), not open to everyone on the computer.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-p", "--parents"], key: "parents" },
      { names: ["-m", "--mode"], key: "mode", takesValue: true },
      { names: ["-v", "--verbose"], key: "verbose" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const modeText = optionValue(parsed.value, "mode");
    const mode = modeText === undefined ? undefined : parseOctalMode(modeText.padStart(3, "0"));
    if (modeText !== undefined && mode === undefined) {
      return usage(
        NAME,
        { code: "BAD_ARGUMENT", argument: "mode", value: modeText, reason: "bad-format" },
        state,
      );
    }
    const dirs = parsed.value.positionals;
    if (dirs.length === 0) {
      return usage(NAME, { code: "MISSING_ARGUMENT", argument: "operand" }, state);
    }
    const parents = hasSwitch(parsed.value, "parents");
    let next = state;
    const output: OutputLine[] = [];
    const events: SimEvent[] = [];
    let failed = false;
    for (const dir of dirs) {
      const { vfs, ctx: fsCtx } = sessionFs(next, ctx.now);
      const existed = stat(vfs, fsCtx, dir).ok;
      const made = makeDir(vfs, fsCtx, dir, {
        parents,
        ...(mode !== undefined && { mode }),
      });
      if (!made.ok) {
        output.push(fsErrorLine(NAME, made.error, "cannot create directory"));
        failed = true;
        continue;
      }
      if (existed) continue;
      next = withSessionFs(next, made.value);
      const path = realpath(made.value, fsCtx, dir);
      if (path.ok) events.push(fileChanged(next, path.value, "created"));
      if (hasSwitch(parsed.value, "verbose"))
        output.push(stdout(`mkdir: created directory '${dir}'`));
    }
    return { state: next, output, events, exitCode: failed ? 1 : 0 };
  },
};
