/**
 * The engine's only entry point:
 *
 *   step(state, cmd, ctx) => { state, output, events, exitCode }
 *
 * It never mutates its inputs, never reads real time or randomness, and never evaluates anything
 * the learner typed as code: command names are looked up in the tool registry, and a tool is a
 * plain function over data. A `shell` command arrives already parsed into a structure (see
 * shell/types.ts); the engine runs that structure, it never re-reads shell syntax.
 */
import { defaultRegistry } from "../tools";
import { runShell } from "../shell/run";
import { freezeInDev } from "./freeze";
import { revealFlags, runTool } from "./run-tool";
import type { ExecCommand, SimCommand, SimContext, SimResult, SimState } from "./types";

export function step(state: SimState, cmd: SimCommand, ctx: SimContext): SimResult {
  const now = ctx.now(); // exactly once per step, so a stepping clock stays in sync with commands
  const registry = ctx.registry ?? defaultRegistry;
  switch (cmd.type) {
    case "exec":
      return freezeInDev(exec(state, cmd, { registry, now }));
    case "shell":
      return freezeInDev(runShell(state, cmd, { registry, now }));
  }
}

function exec(
  state: SimState,
  cmd: ExecCommand,
  options: { registry: NonNullable<SimContext["registry"]>; now: number },
): SimResult {
  const result = runTool(state, cmd.argv, {
    ...options,
    ...(cmd.stdin !== undefined && { stdin: cmd.stdin }),
  });
  if (result.events.length === 0) return result; // an empty line: nothing ran
  // Flags found come just before the closing command.run event.
  const flags = revealFlags(result.state, result.output);
  const events = [...result.events];
  events.splice(events.length - 1, 0, ...flags.events);
  return { ...result, state: flags.state, events };
}
