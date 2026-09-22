import { errorLineText, stdout, success } from "../../core/output";
import { fsMessage, type FsError } from "../../core/errors";
import { sessionFs, withSession } from "../../core/session";
import type { SimResult, SimState } from "../../core/types";
import { canAccess } from "../../fs/perms";
import { resolvePath } from "../../fs/resolve";
import { joinPath } from "../../fs/path";
import { parseArgs } from "../args";
import type { Tool } from "../types";
import { usage } from "./shared";

const NAME = "cd";

/** bash words its own errors with "bash: cd:" in front. */
const fail = (error: FsError, state: SimState): SimResult => ({
  state,
  output: [errorLineText(`bash: cd: ${error.path}: ${fsMessage(error.code)}`, error)],
  events: [],
  exitCode: 1,
});

export const cd: Tool = {
  name: NAME,
  category: "look-around",
  help: {
    oneLiner: "move into another folder, like double-clicking it in a file browser.",
    usage: ["cd [folder]"],
    description: [
      "cd changes the folder the terminal is working in. Every command you run afterwards starts from there, so `ls` lists that folder and `cat notes.txt` looks for notes.txt there.",
      "A path can start from the top of the computer (/etc), or from where you are (documents). Two dots (..) mean the folder above this one, and a tilde (~) means your home folder, the one that belongs to your account. cd on its own takes you home, and cd - takes you back to the folder you were in before.",
      "To go into a folder you need permission to enter it: the x (search) permission on that folder.",
    ],
    options: [{ flags: "-", text: "Go back to the folder you were in before." }],
    examples: [
      { command: "cd documents", text: "Go into the documents folder inside this one." },
      { command: "cd ..", text: "Go up one folder." },
      { command: "cd /var/log", text: "Go to the folder where logs are kept, from anywhere." },
      { command: "cd", text: "Go back to your home folder." },
    ],
    concept: [
      "Moving around a computer's folders is how you explore it. Knowing the usual places matters: settings live in /etc, logs in /var/log, each person's files in /home, and temporary files in /tmp. Attackers know them too, which is why defenders check them first.",
      "Folders can be locked so only some accounts can enter them. /root, the admin's home, usually lets nobody else in. That's a permission doing its job.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, []);
    if (!parsed.ok) {
      // "cd -" is a folder, not an option.
      if (args[0] !== "-") return usage(NAME, parsed.error, state);
    }
    const positionals = parsed.ok ? parsed.value.positionals : args;
    if (positionals.length > 1) {
      return {
        state,
        output: [
          errorLineText("bash: cd: too many arguments", {
            code: "BAD_ARGUMENT",
            argument: "folder",
            value: positionals[1] ?? "",
            reason: "extra-argument",
          }),
        ],
        events: [],
        exitCode: 1,
      };
    }
    const env = state.session.env;
    const home = Object.hasOwn(env, "HOME") ? (env.HOME as string) : "/";
    let target = positionals[0] ?? home;
    let announce = false;
    if (target === "-") {
      const previous = Object.hasOwn(env, "OLDPWD") ? env.OLDPWD : undefined;
      if (previous === undefined) {
        return {
          state,
          output: [
            errorLineText("bash: cd: OLDPWD not set", {
              code: "MISSING_ARGUMENT",
              argument: "OLDPWD",
            }),
          ],
          events: [],
          exitCode: 1,
        };
      }
      target = previous;
      announce = true; // like bash, `cd -` prints where it went
    }
    if (target === "") return success(state, []);

    const { vfs, ctx: fsCtx } = sessionFs(state, ctx.now);
    const found = resolvePath(vfs, fsCtx.actor, state.session.cwd, target);
    if (!found.ok) return fail({ ...found.error, path: target }, state);
    if (found.value.node.kind !== "dir") return fail({ code: "ENOTDIR", path: target }, state);
    if (!canAccess(fsCtx.actor, found.value.node, "x")) {
      return fail({ code: "EACCES", path: target }, state);
    }
    const cwd = joinPath(found.value.parts);
    const next = withSession(state, {
      cwd,
      env: { ...env, OLDPWD: state.session.cwd, PWD: cwd },
    });
    return success(next, announce ? [stdout(cwd)] : []);
  },
};
