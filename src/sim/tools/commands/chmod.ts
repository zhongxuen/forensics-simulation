import { stdout } from "../../core/output";
import { fileChanged, sessionFs, withSessionFs } from "../../core/session";
import type { OutputLine, SimEvent } from "../../core/types";
import { formatMode, formatOctal, parseOctalMode, SETGID, SETUID, STICKY } from "../../fs/mode";
import { chmod as changeMode, listDir, stat } from "../../fs/ops";
import { hasSwitch, parseArgs } from "../args";
import type { Tool } from "../types";
import { fsErrorLine, usage } from "./shared";

const NAME = "chmod";

const CLASS_SHIFT = { u: 6, g: 3, o: 0 } as const;

const SYMBOLIC_CLAUSE = "[ugoa]*(?:[+\\-=][rwxXst]*)+";
/** "644", or symbolic clauses like "u+x" and "go-w,a+r". */
const MODE_PATTERN = new RegExp(`^(?:[0-7]{1,4}|${SYMBOLIC_CLAUSE}(?:,${SYMBOLIC_CLAUSE})*)$`);

/**
 * Applies a mode like "644", "u+x", "go-w" or "a=r,u+w" to `mode`. Returns undefined if the
 * mode can't be read. Symbolic modes without u/g/o/a apply to everyone.
 */
export function applyMode(mode: number, spec: string, isDir: boolean): number | undefined {
  if (/^[0-7]{1,4}$/.test(spec)) return parseOctalMode(spec.padStart(3, "0"));
  let result = mode;
  for (const clause of spec.split(",")) {
    const match = /^([ugoa]*)((?:[+\-=][rwxXst]*)+)$/.exec(clause);
    if (!match) return undefined;
    const whoText = match[1] || "a";
    const who = new Set<"u" | "g" | "o">(
      whoText.includes("a") ? ["u", "g", "o"] : ([...whoText] as ("u" | "g" | "o")[]),
    );
    for (const [, op, perms = ""] of (match[2] ?? "").matchAll(/([+\-=])([rwxXst]*)/g)) {
      let bits = 0;
      const anyExecute = (result & 0o111) !== 0;
      for (const cls of who) {
        const shift = CLASS_SHIFT[cls];
        if (perms.includes("r")) bits |= 4 << shift;
        if (perms.includes("w")) bits |= 2 << shift;
        if (perms.includes("x") || (perms.includes("X") && (isDir || anyExecute)))
          bits |= 1 << shift;
        if (perms.includes("s") && cls === "u") bits |= SETUID;
        if (perms.includes("s") && cls === "g") bits |= SETGID;
      }
      if (perms.includes("t") && (who.has("o") || whoText === "a")) bits |= STICKY;
      if (op === "+") result |= bits;
      else if (op === "-") result &= ~bits;
      else {
        let clear = 0;
        for (const cls of who) clear |= 7 << CLASS_SHIFT[cls];
        if (who.has("u")) clear |= SETUID;
        if (who.has("g")) clear |= SETGID;
        result = (result & ~clear) | bits;
      }
    }
  }
  return result & 0o7777;
}

export const chmod: Tool = {
  name: NAME,
  category: "permissions",
  help: {
    oneLiner: "change who may read, change, or run a file: its permissions.",
    usage: ["chmod [options] mode file...", "chmod 600 secret.txt", "chmod u+x script.sh"],
    description: [
      "Every file has a lock with three sets of rules: one for its owner (u), one for its group (g), and one for everyone else (o, for others). Each set says whether they may read (r), write, meaning change (w), and execute, meaning run (x). ls -l shows them as letters, like rw-r--r--: the owner may read and change, everyone else may only read.",
      "chmod changes those rules. With letters: u+x lets the owner run the file, go-r stops the group and others reading it, a=r lets all (a) read and nothing more. With numbers: each set is one digit adding up read (4), write (2) and run (1). So 6 is read and write, 4 is read only, 0 is nothing, and 640 means owner read and write, group read, others nothing.",
      "Only the file's owner, or root, can change its permissions.",
    ],
    options: [
      { flags: "-R, --recursive", text: "Change a folder and everything inside it." },
      { flags: "-v, --verbose", text: "Say what changed for each file." },
    ],
    examples: [
      {
        command: "chmod 600 secrets.txt",
        text: "Only you may read or change secrets.txt: nobody else can even read it.",
      },
      {
        command: "chmod o-r config.ini",
        text: "Stop everyone outside the owner and group reading config.ini.",
      },
      { command: "chmod u+x backup.sh", text: "Let the owner run backup.sh as a program." },
    ],
    concept: [
      "Loose permissions are one of the most common real weaknesses: a file of passwords that every account can read, or a program that anyone can change so it does something else next time it runs. Fixing them is a defender's everyday job.",
      "The rule to follow is least privilege: give each file the tightest permissions that still let the right people do their work. For a secret, that's usually 600 (owner only).",
    ],
  },

  run(args, state, ctx) {
    // A mode like -w looks like an option, but it's a mode: pull it out first. (-R and -v aren't
    // modes, because R and v aren't permission letters.)
    const modeIndex = args.findIndex((arg) => MODE_PATTERN.test(arg));
    const rest = modeIndex === -1 ? [...args] : args.filter((_, i) => i !== modeIndex);
    const parsed = parseArgs(rest, [
      { names: ["-R", "--recursive"], key: "recursive" },
      { names: ["-v", "--verbose"], key: "verbose" },
      { names: ["-c", "--changes"], key: "verbose" },
    ]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const modeText = modeIndex === -1 ? parsed.value.positionals[0] : args[modeIndex];
    const files = modeIndex === -1 ? parsed.value.positionals.slice(1) : parsed.value.positionals;
    if (modeText === undefined)
      return usage(NAME, { code: "MISSING_ARGUMENT", argument: "operand" }, state);
    if (files.length === 0) {
      return usage(
        NAME,
        { code: "MISSING_ARGUMENT", argument: `operand after '${modeText}'` },
        state,
      );
    }
    if (applyMode(0o644, modeText, false) === undefined) {
      return usage(
        NAME,
        { code: "BAD_ARGUMENT", argument: "mode", value: modeText, reason: "bad-format" },
        state,
      );
    }

    let next = state;
    const output: OutputLine[] = [];
    const events: SimEvent[] = [];
    let failed = false;
    const verbose = hasSwitch(parsed.value, "verbose");

    const change = (path: string, depth: number) => {
      const { vfs, ctx: fsCtx } = sessionFs(next, ctx.now);
      const info = stat(vfs, fsCtx, path);
      if (!info.ok) {
        output.push(fsErrorLine(NAME, info.error, "cannot access"));
        failed = true;
        return;
      }
      const mode = applyMode(info.value.mode, modeText, info.value.kind === "dir") as number;
      const changed = changeMode(vfs, fsCtx, path, mode);
      if (!changed.ok) {
        output.push(fsErrorLine(NAME, changed.error, "changing permissions of"));
        failed = true;
        return;
      }
      next = withSessionFs(next, changed.value);
      if (mode !== info.value.mode) {
        events.push(fileChanged(next, info.value.path, "permissions"));
        if (verbose) {
          output.push(
            stdout(
              `mode of '${path}' changed from ${formatOctal(info.value.mode)} (${formatMode(info.value.kind, info.value.mode).slice(1)}) to ${formatOctal(mode)} (${formatMode(info.value.kind, mode).slice(1)})`,
            ),
          );
        }
      }
      if (hasSwitch(parsed.value, "recursive") && info.value.kind === "dir" && depth < 32) {
        const listing = listDir(changed.value, fsCtx, path);
        if (listing.ok) {
          for (const entry of listing.value) {
            if (entry.kind !== "symlink")
              change(`${path.replace(/\/+$/, "")}/${entry.name}`, depth + 1);
          }
        }
      }
    };
    for (const file of files) change(file, 0);
    return { state: next, output, events, exitCode: failed ? 1 : 0 };
  },
};
