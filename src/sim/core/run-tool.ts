/**
 * Runs one tool by name: the lookup, `--help`, the tool itself, and the events every command gets.
 * `step` uses it for `exec` commands, the shell runs it once per command in a pipeline, and `sudo`
 * runs the command it was given through it. Nothing a learner types is evaluated as code: the
 * name is looked up in the registry, and a tool is a plain function over data.
 */
import { renderHelp } from "../tools/help";
import type { ToolRegistry } from "../tools/types";
import { stripAnsi } from "./ansi";
import { failure, formatArgv, success } from "./output";
import { createRng, deriveSeed } from "./rng";
import type { OutputLine, SimEvent, SimResult, SimState } from "./types";

export interface RunToolOptions {
  readonly registry: ToolRegistry;
  readonly now: number;
  readonly stdin?: string;
  readonly tty?: boolean;
}

/**
 * Runs `argv` as one command. The tick goes up by one, and the command's randomness is derived
 * from the run's seed and that tick. Adds a `command.error` event for each error line and a
 * `command.run` event last. Flags are checked by the caller, on what reaches the screen.
 */
export function runTool(
  state: SimState,
  argv: readonly string[],
  options: RunToolOptions,
): SimResult {
  const [name, ...args] = argv;
  if (name === undefined || name.trim() === "") return success(state, []);

  const tick = state.tick + 1;
  const base: SimState = { ...state, tick };
  const tool = options.registry.get(name);
  let result: SimResult;
  if (!tool) {
    result = failure(name, { code: "UNKNOWN_COMMAND", command: name }, base);
  } else if (asksForHelp(args)) {
    result = success(base, renderHelp(tool.name, tool.help), [
      { type: "help.viewed", command: tool.name },
    ]);
  } else {
    result = tool.run(args, base, {
      rng: createRng(deriveSeed(state.seed, tick)),
      now: options.now,
      tick,
      tty: options.tty ?? false,
      registry: options.registry,
      ...(options.stdin !== undefined && { stdin: options.stdin }),
    });
  }

  const events: SimEvent[] = [...result.events];
  for (const output of result.output) {
    if (output.error) events.push({ type: "command.error", command: name, ...output.error });
  }
  events.push({
    type: "command.run",
    command: name,
    line: formatArgv(argv),
    exitCode: result.exitCode,
  });
  return { ...result, events };
}

/** Every tool supports `--help`, handled here so no tool can forget it. A `--` ends options. */
function asksForHelp(args: readonly string[]): boolean {
  const help = args.indexOf("--help");
  const end = args.indexOf("--");
  return help !== -1 && (end === -1 || help < end);
}

/**
 * Flags found in `output`: a flag counts as found when its token appears in text the learner can
 * see. Colour codes are ignored, so a token highlighted by `grep` still counts.
 */
export function revealFlags(
  state: SimState,
  output: readonly OutputLine[],
): { state: SimState; events: SimEvent[] } {
  const text = stripAnsi(output.map((line) => line.text).join("\n"));
  const found = state.flags.filter(
    (flag) => !state.flagsFound.includes(flag.id) && text.includes(flag.token),
  );
  if (found.length === 0) return { state, events: [] };
  return {
    state: { ...state, flagsFound: [...state.flagsFound, ...found.map((flag) => flag.id)] },
    events: found.map((flag) => ({ type: "flag.found", flagId: flag.id })),
  };
}
