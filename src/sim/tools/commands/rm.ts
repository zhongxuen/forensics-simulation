import { errorLineText, stdout } from "../../core/output";
import { fileChanged, sessionFs, withSessionFs } from "../../core/session";
import type { OutputLine, SimEvent } from "../../core/types";
import { listDir, rm as remove, stat } from "../../fs/ops";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { fsErrorLine, usage } from "./shared";

const NAME = "rm";

export const rm: Tool = {
  name: NAME,
  category: "change",
  help: {
    oneLiner: "delete files, or with -r, whole folders.",
    usage: ["rm [options] file..."],
    description: [
      "rm (remove) deletes the files you name. There's no recycle bin on the command line: on a real computer, a deleted file is gone for good. Here, the Reset button brings everything back.",
      "Folders need -r (recursive), which deletes the folder and everything inside it. -f (force) stops rm complaining about files that aren't there.",
      "To delete something you need permission to change the folder it's in, the w permission on that folder. In shared folders like /tmp, the sticky bit (the t at the end of drwxrwxrwt) means only a file's owner can delete it.",
      "rm refuses to delete the root folder, /, the top of the whole computer, unless you add --no-preserve-root. That safety catch exists because that mistake erases everything.",
    ],
    options: [
      { flags: "-r, -R, --recursive", text: "Delete folders and everything inside them." },
      { flags: "-f, --force", text: "Don't complain about missing files." },
      { flags: "-d, --dir", text: "Delete empty folders." },
      { flags: "-v, --verbose", text: "Say each thing it deletes." },
      { flags: "--no-preserve-root", text: "Turn off the safety catch that protects /." },
    ],
    examples: [
      { command: "rm old.txt", text: "Delete old.txt." },
      { command: "rm -r scratch", text: "Delete the scratch folder and everything in it." },
      {
        command: "rm -rf /tmp/test",
        text: "Delete /tmp/test, without complaining if it's already gone.",
      },
    ],
    concept: [
      "Deleting is permanent on a real system, so professionals double-check the path first (pwd and ls help) and keep backups. A backup is a copy kept somewhere safe; it's how organisations recover after ransomware, which is harmful software that scrambles files and demands payment.",
      "Attackers delete logs to hide their tracks. That's why defenders send logs to a separate computer as they're written, and why a gap in a log is a clue in itself.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["-r", "-R", "--recursive"], key: "recursive" },
      { names: ["-f", "--force"], key: "force" },
      { names: ["-d", "--dir"], key: "dir" },
      { names: ["-v", "--verbose"], key: "verbose" },
      { names: ["--no-preserve-root"], key: "noPreserveRoot" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const force = hasSwitch(parsed.value, "force");
    const recursive = hasSwitch(parsed.value, "recursive");
    const verbose = hasSwitch(parsed.value, "verbose");
    const targets = parsed.value.positionals;
    if (targets.length === 0) {
      return force
        ? { state, output: [], events: [], exitCode: 0 }
        : usage(NAME, { code: "MISSING_ARGUMENT", argument: "operand" }, state);
    }

    let next = state;
    const output: OutputLine[] = [];
    const events: SimEvent[] = [];
    let failed = false;

    const removeOne = (target: string, shownAs = target) => {
      const { vfs, ctx: fsCtx } = sessionFs(next, ctx.now);
      const info = stat(vfs, fsCtx, target, { follow: false });
      // -d deletes a folder only when it's empty.
      const emptyDir =
        hasSwitch(parsed.value, "dir") &&
        info.ok &&
        info.value.kind === "dir" &&
        (() => {
          const listing = listDir(vfs, fsCtx, target);
          return listing.ok && listing.value.length === 0;
        })();
      const removed = remove(vfs, fsCtx, target, { recursive: recursive || emptyDir, force });
      if (!removed.ok) {
        output.push(
          fsErrorLine(
            NAME,
            {
              ...removed.error,
              path: removed.error.path === target ? shownAs : removed.error.path,
            },
            "cannot remove",
          ),
        );
        failed = true;
        return;
      }
      if (!info.ok) return; // -f on something that wasn't there
      next = withSessionFs(next, removed.value);
      events.push(fileChanged(next, info.value.path, "deleted"));
      if (verbose) {
        output.push(
          stdout(
            info.value.kind === "dir" ? `removed directory '${shownAs}'` : `removed '${shownAs}'`,
          ),
        );
      }
    };

    for (const target of targets) {
      const { vfs, ctx: fsCtx } = sessionFs(next, ctx.now);
      const resolved = stat(vfs, fsCtx, target);
      const isRoot = resolved.ok && resolved.value.path === "/" && !/(^|\/)\.\.?\/*$/.test(target);
      if (isRoot && recursive) {
        if (!hasSwitch(parsed.value, "noPreserveRoot")) {
          const error = { code: "EBUSY", path: target, detail: "root" } as const;
          output.push(
            errorLineText(`rm: it is dangerous to operate recursively on '${target}'`, error),
            errorLineText("rm: use --no-preserve-root to override this failsafe", error),
          );
          failed = true;
          continue;
        }
        // The safety catch is off: delete everything at the top that this account may delete.
        const listing = listDir(vfs, fsCtx, "/");
        if (listing.ok) for (const entry of listing.value) removeOne(entry.path);
        continue;
      }
      removeOne(target);
    }
    return { state: next, output, events, exitCode: failed ? 1 : 0 };
  },
};
